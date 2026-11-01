import { useEffect, useState, type FormEvent } from 'react';
import type { Venue } from '../../backend/src/db';
import type { PublicEvent } from '../../backend/src/events';
import type { Report } from '../../backend/src/report';
import { formatDay } from './format';
import { href } from './router';
import { useSession } from './session';

/**
 * The administrator's final decision (spec §7), pre-filled from the top
 * recommendation but freely changeable.
 */
export function PublishForm({ report }: { report: Report }) {
  const { call } = useSession();
  const top = report.recommendations[0];
  const [venues, setVenues] = useState<Venue[]>([]);
  const [problem, setProblem] = useState<string>();
  const [form, setForm] = useState({
    title: 'Team outing',
    date: top?.date ?? report.days[0],
    time: (top?.time ?? '21:00') as string,
    venueId: top?.venueId ?? '',
    alternative: '',
    notes: '',
    participantCount: top ? String(top.available) : '',
  });

  useEffect(() => {
    call<Venue[]>('listVenues').then(
      (all) => setVenues(all.filter((v) => v.enabled)),
      (e: Error) => setProblem(e.message),
    );
  }, [call]);

  const set = (changes: Partial<typeof form>) => setForm({ ...form, ...changes });

  async function publish(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    try {
      const published = await call<PublicEvent>('publishEvent', {
        roundId: report.roundId,
        ...form,
        participantCount: form.participantCount === '' ? null : Number(form.participantCount),
      });
      window.location.hash = href('events', published.eventId);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  return (
    <form onSubmit={publish} aria-label="Publish the outing">
      <h3>Publish the outing</h3>
      <p className="muted">
        Pre-filled with the top recommendation — you have the final say. The event page is public:
        it shows only the details below.
      </p>
      <div className="form-grid">
        <label className="wide">
          Title
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>
          Date
          <select value={form.date} onChange={(e) => set({ date: e.target.value })}>
            {report.days.map((day) => (
              <option key={day} value={day}>
                {formatDay(day)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time
          <input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </label>
        <label className="wide">
          Venue
          <select value={form.venueId} onChange={(e) => set({ venueId: e.target.value })}>
            <option value="">Choose…</option>
            {venues.map((v) => (
              <option key={v.venueId} value={v.venueId}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Alternative venue or plan (optional)
          <input value={form.alternative} onChange={(e) => set({ alternative: e.target.value })} />
        </label>
        <label className="wide">
          Notes for participants (optional)
          <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <label>
          Expected participants (optional)
          <input
            inputMode="numeric"
            value={form.participantCount}
            onChange={(e) => set({ participantCount: e.target.value })}
          />
        </label>
      </div>
      {problem && <p role="alert">{problem}</p>}
      <button type="submit" className="primary">
        Publish
      </button>
    </form>
  );
}

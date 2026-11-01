import { useEffect, useState } from 'react';
import type { EventSummary } from '../../backend/src/events';
import { callBackend } from './api';
import { formatLongDay } from './format';
import { href } from './router';

/** The team's public outing history (spec §8). Needs no sign-in. */
export function Archive() {
  const [events, setEvents] = useState<EventSummary[]>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    callBackend<EventSummary[]>('listPublicEvents').then(setEvents, (e: Error) =>
      setProblem(e.message),
    );
  }, []);

  if (problem) return <p role="alert">{problem}</p>;
  if (!events) return <p>Loading…</p>;

  const upcoming = events.filter((e) => e.status === 'upcoming');
  const past = events.filter((e) => e.status === 'past');
  return (
    <section>
      <h1>Team outings</h1>
      {events.length === 0 && <p>No outings have been published yet.</p>}
      <EventList title="Upcoming" events={upcoming} />
      <EventList title="Past" events={past} />
    </section>
  );
}

function EventList({ title, events }: { title: string; events: EventSummary[] }) {
  if (events.length === 0) return null;
  return (
    <>
      <h2>{title}</h2>
      <ul className="cards" aria-label={`${title} outings`}>
        {events.map((event) => (
          <li key={event.eventId}>
            <a href={href('events', event.eventId)}>
              <strong>{event.title}</strong>
            </a>
            <div>
              {formatLongDay(event.date)} at {event.time} · {event.venueName}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

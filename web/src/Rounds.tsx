import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { RoundView } from '../../backend/src/rounds';
import { formatDateTime, formatDay, localInputToIso } from './format';
import { href } from './router';
import { useSession } from './session';

const STATUS_LABELS: Record<RoundView['status'], string> = {
  draft: 'Draft — not open for voting yet',
  open: 'Open for voting',
  closed: 'Voting closed',
  published: 'Published',
};

export function Rounds() {
  const { call } = useSession();
  const [rounds, setRounds] = useState<RoundView[]>();
  const [problem, setProblem] = useState<string>();

  const reload = useCallback(
    () => call<RoundView[]>('listRounds').then(setRounds, (e: Error) => setProblem(e.message)),
    [call],
  );
  useEffect(() => void reload(), [reload]);

  const run = async (action: string, payload: Record<string, unknown>) => {
    setProblem(undefined);
    try {
      await call(action, payload);
      await reload();
      return true;
    } catch (error) {
      setProblem((error as Error).message);
      return false;
    }
  };

  const active = rounds?.find((r) => r.status !== 'published');

  return (
    <section>
      <h2>Voting rounds</h2>
      {problem && <p role="alert">{problem}</p>}
      {!rounds && !problem && <p>Loading…</p>}
      {rounds && !active && <CreateRound run={run} />}
      {active && <ActiveRound round={active} run={run} />}
      {rounds && <PastRounds rounds={rounds.filter((r) => r.status === 'published')} />}
    </section>
  );
}

type Run = (action: string, payload: Record<string, unknown>) => Promise<boolean>;

function CreateRound({ run }: { run: Run }) {
  const [week, setWeek] = useState('');
  const [deadline, setDeadline] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void run('createRound', { week, deadline: localInputToIso(deadline) });
  }

  return (
    <form onSubmit={submit} aria-label="Start a voting round">
      <h3>Start a voting round</h3>
      <p className="muted">Pick any day in the week of interest. Members vote for Monday–Friday.</p>
      <div className="form-grid">
        <label>
          Week
          <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
        </label>
        <label>
          Voting deadline
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>
      <button type="submit" className="primary">
        Create draft round
      </button>
    </form>
  );
}

function ActiveRound({ round, run }: { round: RoundView; run: Run }) {
  const [deadline, setDeadline] = useState('');
  const roundId = round.roundId;

  return (
    <article aria-label="Current round">
      <h3>
        Week of {formatDay(round.days[0])} – {formatDay(round.days[round.days.length - 1])}
      </h3>
      <p>
        <strong>{STATUS_LABELS[round.status]}</strong>
        <br />
        Deadline: {formatDateTime(round.deadline)}
      </p>
      {round.status !== 'draft' && (
        <details>
          <summary>
            {round.eligible.filter((p) => p.voted).length} of {round.eligible.length} have voted
          </summary>
          <ul aria-label="Participation">
            {round.eligible.map((p) => (
              <li key={p.userId}>
                {p.displayName || p.email} — {p.voted ? 'voted' : 'not voted yet'}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="actions">
        {round.status === 'draft' && (
          <>
            <button className="primary" onClick={() => void run('openRound', { roundId })}>
              Open voting
            </button>
            <button className="danger" onClick={() => void run('deleteRound', { roundId })}>
              Delete draft
            </button>
          </>
        )}
        {round.status === 'open' && (
          <button onClick={() => void run('closeRound', { roundId })}>Close voting</button>
        )}
      </div>

      {round.status === 'closed' && (
        <p>
          <a className="button primary" href={href('admin', 'rounds', roundId, 'report')}>
            View results
          </a>
        </p>
      )}

      {round.status === 'closed' && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run('reopenRound', { roundId, deadline: localInputToIso(deadline) });
          }}
        >
          <label>
            New deadline
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          <button type="submit">Reopen voting</button>
        </form>
      )}
    </article>
  );
}

function PastRounds({ rounds }: { rounds: RoundView[] }) {
  if (rounds.length === 0) return null;
  return (
    <>
      <h3>Published rounds</h3>
      <ul className="cards" aria-label="Published rounds">
        {rounds.map((round) => (
          <li key={round.roundId}>
            Week of {formatDay(round.days[0])}
            <div className="actions">
              {round.eventId && <a href={href('events', round.eventId)}>Event page</a>}
              <a href={href('admin', 'rounds', round.roundId, 'report')}>Results</a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

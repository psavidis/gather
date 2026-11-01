import { useEffect, useState } from 'react';
import type { CurrentRound } from '../../backend/src/votes';
import { formatDateTime, formatDay } from './format';
import { href } from './router';
import { useSession } from './session';

export function Home() {
  const { call, user } = useSession();
  const [round, setRound] = useState<CurrentRound | null>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    call<CurrentRound | null>('getCurrentRound').then(setRound, (e: Error) =>
      setProblem(e.message),
    );
  }, [call]);

  return (
    <section>
      <p className="muted">
        Signed in as <strong>{user.email}</strong> with the role <strong>{user.role}</strong>.
      </p>
      {problem && <p role="alert">{problem}</p>}
      {round === null && <p>There is no voting round open right now.</p>}
      {round && <RoundCard round={round} />}
    </section>
  );
}

function RoundCard({ round }: { round: CurrentRound }) {
  const week = `the week of ${formatDay(round.days[0])} – ${formatDay(round.days[round.days.length - 1])}`;

  if (!round.participant) {
    return (
      <p>
        Voting is under way for {week}, but you are not a participant in this round because you were
        added after it started.
      </p>
    );
  }
  if (round.status === 'closed') {
    return (
      <p>
        Voting has closed for {week}. {round.myVote && 'Thanks for voting! '}The administrator will
        publish the outing soon.
      </p>
    );
  }
  return (
    <article aria-label="Current round">
      <h2>Where and when should we go out?</h2>
      <p>
        Voting is open for {week}.
        <br />
        Deadline: {formatDateTime(round.deadline)}
      </p>
      {round.myVote && <p>You have voted. You can change your vote until voting closes.</p>}
      <a className="button primary" href={href('vote')}>
        {round.myVote ? 'Change my vote' : 'Vote now'}
      </a>
    </article>
  );
}

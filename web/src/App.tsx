import { Archive } from './Archive';
import { EventPage } from './EventPage';
import { Home } from './Home';
import { href, useRoute } from './router';
import { Report } from './Report';
import { Rounds } from './Rounds';
import { SessionProvider, useSessionState } from './session';
import { SignIn } from './SignIn';
import { Users } from './Users';
import { Venues } from './Venues';
import { Vote } from './Vote';

export function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const { session } = useSessionState();
  const route = useRoute();

  return (
    <>
      <header className="top-bar">
        <a className="brand" href={href()}>
          Gather
        </a>
        <nav aria-label="Main">
          <a href={href('events')}>Outings</a>
          {session && (
            <>
              {session.user.role === 'admin' && (
                <>
                  <a href={href('admin', 'rounds')}>Rounds</a>
                  <a href={href('admin', 'users')}>Users</a>
                  <a href={href('admin', 'venues')}>Venues</a>
                </>
              )}
              <button className="link" onClick={session.signOut}>
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>
      <main>
        <Page route={route} />
      </main>
    </>
  );
}

/** Public pages need no sign-in (spec §8); everything else does. */
function Page({ route }: { route: string[] }) {
  const { session } = useSessionState();
  if (route[0] === 'events') return route[1] ? <EventPage eventId={route[1]} /> : <Archive />;
  if (!session) return <SignIn />;

  const user = session.user;

  if (route[0] === 'admin' && user.role === 'admin') {
    if (route[1] === 'rounds' && route[3] === 'report') return <Report roundId={route[2]} />;
    if (route[1] === 'rounds') return <Rounds />;
    if (route[1] === 'users') return <Users />;
    if (route[1] === 'venues') return <Venues />;
  }

  if (route[0] === 'vote') return <Vote />;
  return <Home />;
}

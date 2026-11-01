import { href, useRoute } from './router';
import { Rounds } from './Rounds';
import { SessionProvider, useSessionState } from './session';
import { SignIn } from './SignIn';
import { Users } from './Users';
import { Venues } from './Venues';

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
        {session && (
          <nav aria-label="Main">
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
          </nav>
        )}
      </header>
      <main>{session ? <SignedInPage route={route} /> : <SignIn />}</main>
    </>
  );
}

function SignedInPage({ route }: { route: string[] }) {
  const { session } = useSessionState();
  const user = session!.user;

  if (route[0] === 'admin' && user.role === 'admin') {
    if (route[1] === 'rounds') return <Rounds />;
    if (route[1] === 'users') return <Users />;
    if (route[1] === 'venues') return <Venues />;
  }

  return (
    <section>
      <p>
        Signed in as <strong>{user.email}</strong> with the role <strong>{user.role}</strong>.
      </p>
    </section>
  );
}

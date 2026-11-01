import { useEffect, useRef, useState } from 'react';
import { signIn, type BackendResponse } from './backend';
import { config } from './config';
import { loadGoogleIdentity } from './google';

type User = Extract<BackendResponse, { ok: true }>['user'];

type State =
  | { kind: 'signedOut' }
  | { kind: 'checking' }
  | { kind: 'signedIn'; user: User }
  | { kind: 'problem'; message: string };

const MESSAGES = {
  unauthenticated:
    'You are not signed in: Google could not confirm your identity. Please try again.',
  forbidden: 'Your account is not authorized to use Gather. Ask the administrator to add you.',
  failed: 'Sign-in failed because Gather could not reach its server. Please try again.',
};

export function App() {
  const [state, setState] = useState<State>({ kind: 'signedOut' });
  const buttonRef = useRef<HTMLDivElement>(null);
  const showButton = state.kind === 'signedOut' || state.kind === 'problem';

  useEffect(() => {
    if (!showButton) return;
    let cancelled = false;

    async function handleCredential(idToken: string) {
      setState({ kind: 'checking' });
      try {
        const result = await signIn(config.backendUrl, idToken);
        if (result.ok) setState({ kind: 'signedIn', user: result.user });
        else if (result.error === 'unauthenticated' || result.error === 'forbidden')
          setState({ kind: 'problem', message: MESSAGES[result.error] });
        else setState({ kind: 'problem', message: MESSAGES.failed });
      } catch {
        setState({ kind: 'problem', message: MESSAGES.failed });
      }
    }

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: ({ credential }) => void handleCredential(credential),
        });
        google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large' });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'problem', message: MESSAGES.failed });
      });

    return () => {
      cancelled = true;
    };
  }, [showButton]);

  return (
    <main>
      <h1>Gather</h1>
      {state.kind === 'checking' && <p>Signing you in…</p>}
      {state.kind === 'signedIn' && (
        <p>
          Signed in as <strong>{state.user.email}</strong> with the role{' '}
          <strong>{state.user.role}</strong>.
        </p>
      )}
      {state.kind === 'problem' && <p role="alert">{state.message}</p>}
      {showButton && <div ref={buttonRef} />}
    </main>
  );
}

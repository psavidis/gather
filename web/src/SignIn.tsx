import { useEffect, useRef, useState } from 'react';
import { ApiError, callBackend } from './api';
import { config } from './config';
import { loadGoogleIdentity } from './google';
import { useSessionState } from './session';
import type { CurrentUser } from '../../backend/src/users';

const MESSAGES: Record<string, string> = {
  unauthenticated:
    'You are not signed in: Google could not confirm your identity. Please try again.',
  forbidden: 'Your account is not authorized to use Gather. Ask the administrator to add you.',
  network: 'Sign-in failed because Gather could not reach its server. Please try again.',
};

export function SignIn() {
  const { start, expired } = useSessionState();
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string>();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCredential(idToken: string) {
      setChecking(true);
      setProblem(undefined);
      try {
        start(await callBackend<CurrentUser>('signIn', {}, idToken), idToken);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'network';
        setProblem(MESSAGES[code] ?? (error as Error).message);
        setChecking(false);
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
        if (!cancelled) setProblem(MESSAGES.network);
      });

    return () => {
      cancelled = true;
    };
  }, [start]);

  return (
    <section className="sign-in">
      <p>Sign in with your Google account to vote on the team&apos;s next outing.</p>
      {expired && !problem && <p role="status">Your session has expired. Please sign in again.</p>}
      {checking && <p>Signing you in…</p>}
      {problem && <p role="alert">{problem}</p>}
      <div ref={buttonRef} hidden={checking} />
    </section>
  );
}

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CurrentUser } from '../../backend/src/users';
import { ApiError, callBackend } from './api';

interface Session {
  user: CurrentUser;
  /** Calls a signed-in action; an expired or rejected token ends the session. */
  call<T>(action: string, payload?: Record<string, unknown>): Promise<T>;
  signOut(): void;
}

interface SessionState {
  session: Session | undefined;
  expired: boolean;
  start(user: CurrentUser, idToken: string): void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

/** Holds the Google ID token in memory only (spec §10: never in localStorage). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ user: CurrentUser; idToken: string }>();
  const [expired, setExpired] = useState(false);

  const start = useCallback((user: CurrentUser, idToken: string) => {
    setExpired(false);
    setCurrent({ user, idToken });
  }, []);

  const session = useMemo<Session | undefined>(() => {
    if (!current) return undefined;
    return {
      user: current.user,
      signOut: () => setCurrent(undefined),
      call: async <T,>(action: string, payload: Record<string, unknown> = {}) => {
        try {
          return await callBackend<T>(action, payload, current.idToken);
        } catch (error) {
          if (error instanceof ApiError && error.code === 'unauthenticated') {
            setExpired(true);
            setCurrent(undefined);
          }
          throw error;
        }
      },
    };
  }, [current]);

  const value = useMemo(() => ({ session, expired, start }), [session, expired, start]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionState(): SessionState {
  const state = useContext(SessionContext);
  if (!state) throw new Error('useSessionState must be used inside SessionProvider');
  return state;
}

export function useSession(): Session {
  const { session } = useSessionState();
  if (!session) throw new Error('useSession requires a signed-in user');
  return session;
}

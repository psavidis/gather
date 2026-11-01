import { authorize, verifyIdToken, type SignInResult } from './auth';
import type { UserStore } from './users';

export interface BackendDeps {
  clientId: string;
  initialAdminEmail: string;
  now: () => Date;
  fetchTokenInfo: (idToken: string) => { status: number; body: string };
  users: UserStore;
}

export type BackendResponse = SignInResult | { ok: false; error: 'bad_request' | 'internal' };

/**
 * Handles one request from the browser. Apps Script cannot set HTTP status
 * codes, so every outcome is expressed in the returned body (assumption A8).
 */
export function handleRequest(rawBody: string, deps: BackendDeps): BackendResponse {
  const request = parseRequest(rawBody);
  if (!request) return { ok: false, error: 'bad_request' };

  const now = deps.now();
  const identity = verifyIdToken(request.idToken, deps.clientId, now, deps.fetchTokenInfo);
  if (!identity) return { ok: false, error: 'unauthenticated' };

  return authorize(identity, deps.users, deps.initialAdminEmail, now);
}

function parseRequest(rawBody: string): { action: 'signIn'; idToken: string } | undefined {
  try {
    const body: unknown = JSON.parse(rawBody);
    if (typeof body !== 'object' || body === null) return undefined;
    const { action, idToken } = body as Record<string, unknown>;
    if (action !== 'signIn' || typeof idToken !== 'string' || !idToken) return undefined;
    return { action, idToken };
  } catch {
    return undefined;
  }
}

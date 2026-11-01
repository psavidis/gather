import { authorize, verifyIdToken, type FetchTokenInfo } from './auth';
import type { Action, Context } from './context';
import { openDb } from './db';
import { AppError, type ErrorCode, type Payload } from './errors';
import type { Spreadsheet } from './spreadsheet';
import { roundActions } from './rounds';
import { userActions } from './users';
import { venueActions } from './venues';
import { voteActions } from './votes';

export interface BackendDeps {
  clientId: string;
  initialAdminEmail: string;
  now: () => Date;
  newId: () => string;
  fetchTokenInfo: FetchTokenInfo;
  spreadsheet: Spreadsheet;
}

export type BackendResponse<T = unknown> =
  { ok: true; data: T } | { ok: false; error: ErrorCode | 'internal'; message: string };

const ACTIONS: Record<string, Action> = {
  ...userActions,
  ...venueActions,
  ...roundActions,
  ...voteActions,
};

/**
 * Handles one request from the browser: `{ action, idToken?, ...payload }`.
 * Apps Script cannot set HTTP status codes, so every outcome is expressed in
 * the returned body (assumption A8). Unexpected errors propagate to the caller.
 */
export function handleRequest(rawBody: string, deps: BackendDeps): BackendResponse {
  try {
    const payload = parse(rawBody);
    const action = ACTIONS[String(payload.action)];
    if (!action) throw new AppError('bad_request', 'Unknown action');

    const ctx: Context = { db: openDb(deps.spreadsheet), now: deps.now(), newId: deps.newId };
    if (action.access === 'public') return { ok: true, data: action.run(ctx, payload) };

    if (typeof payload.idToken !== 'string' || !payload.idToken) {
      throw new AppError('unauthenticated');
    }
    const identity = verifyIdToken(payload.idToken, deps.clientId, ctx.now, deps.fetchTokenInfo);
    const user = authorize(identity, deps.initialAdminEmail, ctx);
    if (action.access === 'admin' && user.role !== 'admin') throw new AppError('forbidden');

    return { ok: true, data: action.run({ ...ctx, user }, payload) };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.code, message: error.message };
    throw error;
  }
}

function parse(rawBody: string): Payload {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AppError('bad_request', 'Request body must be JSON');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('bad_request', 'Request body must be an object');
  }
  return body as Payload;
}

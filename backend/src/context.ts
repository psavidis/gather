import type { Db, User } from './db';
import type { Payload } from './errors';

/** What every action needs: storage, the request time and an ID source. */
export interface Context {
  db: Db;
  now: Date;
  newId: () => string;
}

export interface SignedInContext extends Context {
  user: User;
}

export type Action =
  | { access: 'public'; run: (ctx: Context, payload: Payload) => unknown }
  | { access: 'member' | 'admin'; run: (ctx: SignedInContext, payload: Payload) => unknown };

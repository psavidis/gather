import type { Action, SignedInContext } from './context';
import type { Role, User } from './db';
import { AppError, flag, oneOf, text, type Payload } from './errors';

const ROLES: readonly Role[] = ['admin', 'member'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const currentUser = (user: User) => ({
  email: user.email,
  displayName: user.displayName,
  role: user.role,
});

export const listing = (user: User) => ({
  userId: user.userId,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  enabled: user.enabled,
});

function existing(ctx: SignedInContext, payload: Payload): User {
  const userId = text(payload, 'userId');
  const user = ctx.db.users.find((u) => u.userId === userId);
  if (!user) throw new AppError('not_found', 'User not found');
  return user;
}

function refuseSelf(ctx: SignedInContext, user: User, what: string) {
  if (user.userId === ctx.user.userId) {
    throw new AppError('invalid', `You cannot ${what} your own account`);
  }
}

/** Allowlist management (spec §2 User management, assumption A9). */
export const userActions: Record<string, Action> = {
  signIn: { access: 'member', run: (ctx) => currentUser(ctx.user) },

  listUsers: {
    access: 'admin',
    run: (ctx) => ctx.db.users.all().map(listing),
  },

  addUser: {
    access: 'admin',
    run: (ctx, payload) => {
      const email = text(payload, 'email').toLowerCase();
      if (!EMAIL.test(email)) throw new AppError('invalid', 'Enter a valid email address');
      if (ctx.db.users.find((u) => u.email === email)) {
        throw new AppError('conflict', `${email} is already on the list`);
      }
      const user: User = {
        userId: ctx.newId(),
        email,
        googleSubject: '',
        displayName: '',
        role: oneOf(payload, 'role', ROLES),
        enabled: true,
        createdAt: ctx.now.toISOString(),
      };
      ctx.db.users.insert(user);
      return listing(user);
    },
  },

  updateUser: {
    access: 'admin',
    run: (ctx, payload) => {
      const user = existing(ctx, payload);
      const updated = { ...user };
      if (payload.role !== undefined) {
        updated.role = oneOf(payload, 'role', ROLES);
        if (updated.role !== 'admin') refuseSelf(ctx, user, 'remove the administrator role from');
      }
      if (payload.enabled !== undefined) {
        updated.enabled = flag(payload, 'enabled');
        if (!updated.enabled) refuseSelf(ctx, user, 'disable');
      }
      ctx.db.users.replace((u) => u.userId === user.userId, updated);
      return listing(updated);
    },
  },

  removeUser: {
    access: 'admin',
    run: (ctx, payload) => {
      const user = existing(ctx, payload);
      refuseSelf(ctx, user, 'remove');
      ctx.db.users.remove((u) => u.userId === user.userId);
      return null;
    },
  },
};

export type CurrentUser = ReturnType<typeof currentUser>;
export type UserListing = ReturnType<typeof listing>;

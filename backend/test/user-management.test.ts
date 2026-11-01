import { beforeEach, describe, expect, it } from 'vitest';
import { World } from './support/world';

const ADMIN = 'admin@example.com';
let world: World;

beforeEach(() => {
  world = new World();
  world.ok(ADMIN, 'signIn');
});

const userId = (email: string) => world.user(email)!.userId;

describe('user management', () => {
  it('lists the allowlist', () => {
    world.addUser('maria@example.com');

    expect(world.ok(ADMIN, 'listUsers')).toEqual([
      expect.objectContaining({ email: ADMIN, role: 'admin', enabled: true }),
      expect.objectContaining({ email: 'maria@example.com', role: 'member', enabled: true }),
    ]);
  });

  it('never exposes Google account identifiers', () => {
    expect(JSON.stringify(world.ok(ADMIN, 'listUsers'))).not.toContain('sub-');
  });

  it('adds a member who can then sign in', () => {
    world.ok(ADMIN, 'addUser', { email: 'nikos@example.com', role: 'member' });

    expect(world.as('nikos@example.com', 'signIn')).toMatchObject({
      ok: true,
      data: { role: 'member' },
    });
  });

  it('refuses a duplicate email regardless of letter case', () => {
    world.addUser('maria@example.com');

    expect(world.as(ADMIN, 'addUser', { email: 'Maria@Example.com', role: 'member' })).toEqual({
      ok: false,
      error: 'conflict',
      message: 'maria@example.com is already on the list',
    });
  });

  it.each([['not-an-email'], ['']])('refuses the invalid email %j', (email) => {
    expect(world.as(ADMIN, 'addUser', { email, role: 'member' })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuses an unknown role', () => {
    expect(world.as(ADMIN, 'addUser', { email: 'x@example.com', role: 'owner' })).toMatchObject({
      error: 'invalid',
    });
  });

  it('disables and re-enables a user', () => {
    world.addUser('maria@example.com');

    world.ok(ADMIN, 'updateUser', { userId: userId('maria@example.com'), enabled: false });
    expect(world.as('maria@example.com', 'signIn')).toMatchObject({ error: 'forbidden' });

    world.ok(ADMIN, 'updateUser', { userId: userId('maria@example.com'), enabled: true });
    expect(world.as('maria@example.com', 'signIn')).toMatchObject({ ok: true });
  });

  it('promotes a member to administrator', () => {
    world.addUser('maria@example.com');

    world.ok(ADMIN, 'updateUser', { userId: userId('maria@example.com'), role: 'admin' });

    expect(world.as('maria@example.com', 'listUsers')).toMatchObject({ ok: true });
  });

  it('removes a user, who can then no longer sign in', () => {
    world.addUser('maria@example.com');

    world.ok(ADMIN, 'removeUser', { userId: userId('maria@example.com') });

    expect(world.user('maria@example.com')).toBeUndefined();
    expect(world.as('maria@example.com', 'signIn')).toMatchObject({ error: 'forbidden' });
  });

  it('reports a user that does not exist', () => {
    expect(world.as(ADMIN, 'removeUser', { userId: 'missing' })).toMatchObject({
      error: 'not_found',
    });
  });

  it.each([
    ['disable', { enabled: false }],
    ['remove the administrator role from', { role: 'member' }],
  ])('refuses to let the administrator %s their own account', (change, update) => {
    expect(world.as(ADMIN, 'updateUser', { userId: userId(ADMIN), ...update })).toEqual({
      ok: false,
      error: 'invalid',
      message: `You cannot ${change} your own account`,
    });
    expect(world.user(ADMIN)).toMatchObject({ role: 'admin', enabled: true });
  });

  it('refuses to let the administrator remove their own account', () => {
    expect(world.as(ADMIN, 'removeUser', { userId: userId(ADMIN) })).toMatchObject({
      message: 'You cannot remove your own account',
    });
    expect(world.user(ADMIN)).toBeDefined();
  });

  it.each(['listUsers', 'addUser', 'updateUser', 'removeUser'])(
    'refuses %s to members',
    (action) => {
      world.addUser('maria@example.com');

      expect(world.as('maria@example.com', action, { email: 'x@example.com' })).toMatchObject({
        ok: false,
        error: 'forbidden',
      });
    },
  );
});

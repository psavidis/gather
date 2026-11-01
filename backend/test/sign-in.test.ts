import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/api';
import { World } from './support/world';

describe('sign-in: only verified Google identities are accepted', () => {
  it.each([
    ['Google does not recognise', () => 'forged-token'],
    [
      'was issued for a different application',
      (w: World) => w.google.issue('maria@example.com', { aud: 'other-app' }),
    ],
    [
      'was issued by someone other than Google',
      (w: World) => w.google.issue('maria@example.com', { iss: 'https://evil.example.com' }),
    ],
    [
      'has expired',
      (w: World) => w.google.issue('maria@example.com', { exp: w.now.getTime() / 1000 - 1 }),
    ],
    [
      'carries an unverified email address',
      (w: World) => w.google.issue('maria@example.com', { email_verified: 'false' }),
    ],
  ])('rejects a token that %s', (_problem, makeToken) => {
    const world = new World();
    world.addUser('maria@example.com');

    expect(world.request({ action: 'signIn', idToken: makeToken(world) })).toMatchObject({
      ok: false,
      error: 'unauthenticated',
    });
  });

  it('rejects a request without a token', () => {
    expect(new World().request({ action: 'signIn' })).toMatchObject({ error: 'unauthenticated' });
  });

  it('accepts the short Google issuer form', () => {
    const world = new World();
    world.addUser('maria@example.com');
    const idToken = world.google.issue('maria@example.com', { iss: 'accounts.google.com' });

    expect(world.request({ action: 'signIn', idToken })).toMatchObject({ ok: true });
  });
});

describe('sign-in: only enabled allowlisted users are authorized', () => {
  it('signs in an enabled member', () => {
    const world = new World();
    world.addUser('maria@example.com');
    const idToken = world.google.issue('maria@example.com', { name: 'Maria' });

    expect(world.request({ action: 'signIn', idToken })).toEqual({
      ok: true,
      data: { email: 'maria@example.com', displayName: 'Maria', role: 'member' },
    });
  });

  it('matches email addresses regardless of letter case', () => {
    const world = new World();
    world.addUser('maria@example.com');

    expect(world.as('Maria@Example.com', 'signIn')).toMatchObject({
      ok: true,
      data: { email: 'maria@example.com', role: 'member' },
    });
  });

  it('refuses someone who is not on the allowlist', () => {
    expect(new World().as('stranger@example.com', 'signIn')).toMatchObject({
      ok: false,
      error: 'forbidden',
    });
  });

  it('refuses a disabled user', () => {
    const world = new World();
    world.addUser('maria@example.com', { enabled: false });

    expect(world.as('maria@example.com', 'signIn')).toMatchObject({ error: 'forbidden' });
  });
});

describe('sign-in: the configured initial administrator is bootstrapped once', () => {
  it('creates an enabled administrator entry on first sign-in', () => {
    const world = new World();
    const idToken = world.google.issue('admin@example.com', { sub: 'sub-admin', name: 'Ada' });

    expect(world.request({ action: 'signIn', idToken })).toEqual({
      ok: true,
      data: { email: 'admin@example.com', displayName: 'Ada', role: 'admin' },
    });
    expect(world.user('admin@example.com')).toMatchObject({
      googleSubject: 'sub-admin',
      displayName: 'Ada',
      role: 'admin',
      enabled: true,
      createdAt: world.now.toISOString(),
    });
  });

  it('lets the allowlist override the configuration after bootstrap', () => {
    const world = new World();
    world.addUser('admin@example.com', { role: 'admin', enabled: false });

    expect(world.as('admin@example.com', 'signIn')).toMatchObject({ error: 'forbidden' });
  });

  it('does not bootstrap anyone when no initial administrator is configured', () => {
    const world = new World();
    world.initialAdminEmail = '';

    expect(world.as('admin@example.com', 'signIn')).toMatchObject({ error: 'forbidden' });
    expect(world.db.users.all()).toEqual([]);
  });
});

describe('sign-in: an allowlist entry is bound to one Google account', () => {
  it('remembers the Google account and name on first sign-in', () => {
    const world = new World();
    world.addUser('maria@example.com');

    world.request({
      action: 'signIn',
      idToken: world.google.issue('maria@example.com', { sub: 'sub-1', name: 'Maria' }),
    });

    expect(world.user('maria@example.com')).toMatchObject({
      googleSubject: 'sub-1',
      displayName: 'Maria',
    });
  });

  it('refuses a different Google account with the same email', () => {
    const world = new World();
    world.addUser('maria@example.com', { googleSubject: 'sub-1' });
    const idToken = world.google.issue('maria@example.com', { sub: 'sub-2' });

    expect(world.request({ action: 'signIn', idToken })).toMatchObject({ error: 'forbidden' });
  });
});

describe('request handling', () => {
  it.each([
    ['malformed JSON', '{not json'],
    ['a non-object body', '[1, 2]'],
    ['an unknown action', JSON.stringify({ action: 'dropTables' })],
  ])('rejects %s as a bad request', (_case, body) => {
    expect(handleRequest(body, new World().deps)).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
  });
});

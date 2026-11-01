import { describe, expect, it } from 'vitest';
import { handleRequest, type BackendDeps } from '../src/api';
import type { AllowlistEntry, UserStore } from '../src/users';

const CLIENT_ID = 'gather-client.apps.googleusercontent.com';
const NOW = new Date('2026-11-02T10:00:00Z');
const nowSeconds = NOW.getTime() / 1000;

interface Claims {
  aud?: string;
  iss?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

/** Stands in for Google's tokeninfo endpoint: knows the tokens it has issued. */
class FakeGoogle {
  private readonly issued = new Map<string, Claims>();

  issue(email: string, overrides: Claims = {}): string {
    const token = `token-${this.issued.size + 1}`;
    this.issued.set(token, {
      aud: CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: nowSeconds + 600,
      sub: `sub-${email.toLowerCase()}`,
      email,
      email_verified: 'true',
      name: 'Test Person',
      ...overrides,
    });
    return token;
  }

  tokenInfo = (idToken: string) => {
    const claims = this.issued.get(idToken);
    if (!claims) return { status: 400, body: '{"error":"invalid_token"}' };
    return { status: 200, body: JSON.stringify({ ...claims, exp: String(claims.exp) }) };
  };
}

class InMemoryUserStore implements UserStore {
  readonly entries: AllowlistEntry[] = [];

  findByEmail(email: string) {
    return this.entries.find((e) => e.email.toLowerCase() === email.toLowerCase());
  }
  add(entry: AllowlistEntry) {
    this.entries.push(entry);
  }
  recordGoogleSubject(email: string, subject: string) {
    const entry = this.findByEmail(email);
    if (entry) entry.googleSubject = subject;
  }
}

function member(email: string, overrides: Partial<AllowlistEntry> = {}): AllowlistEntry {
  return {
    email,
    googleSubject: '',
    displayName: '',
    role: 'member',
    enabled: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function setup(initialAdminEmail = 'admin@example.com') {
  const google = new FakeGoogle();
  const users = new InMemoryUserStore();
  const deps: BackendDeps = {
    clientId: CLIENT_ID,
    initialAdminEmail,
    now: () => NOW,
    fetchTokenInfo: google.tokenInfo,
    users,
  };
  const signIn = (idToken: string) =>
    handleRequest(JSON.stringify({ action: 'signIn', idToken }), deps);
  return { google, users, deps, signIn };
}

describe('sign-in: only verified Google identities are accepted', () => {
  it.each([
    ['Google does not recognise', () => 'forged-token'],
    [
      'was issued for a different application',
      (g: FakeGoogle) => g.issue('maria@example.com', { aud: 'other-app' }),
    ],
    [
      'was issued by someone other than Google',
      (g: FakeGoogle) => g.issue('maria@example.com', { iss: 'https://evil.example.com' }),
    ],
    ['has expired', (g: FakeGoogle) => g.issue('maria@example.com', { exp: nowSeconds - 1 })],
    [
      'carries an unverified email address',
      (g: FakeGoogle) => g.issue('maria@example.com', { email_verified: 'false' }),
    ],
  ])('rejects a token that %s', (_problem, makeToken) => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com'));

    expect(signIn(makeToken(google))).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('accepts the short Google issuer form', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com'));

    const result = signIn(google.issue('maria@example.com', { iss: 'accounts.google.com' }));

    expect(result).toMatchObject({ ok: true });
  });
});

describe('sign-in: only enabled allowlisted users are authorized', () => {
  it('signs in an enabled member', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com'));

    expect(signIn(google.issue('maria@example.com', { name: 'Maria' }))).toEqual({
      ok: true,
      user: { email: 'maria@example.com', displayName: 'Maria', role: 'member' },
    });
  });

  it('matches email addresses regardless of letter case', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com'));

    expect(signIn(google.issue('Maria@Example.com'))).toMatchObject({
      ok: true,
      user: { email: 'maria@example.com', role: 'member' },
    });
  });

  it('refuses someone who is not on the allowlist', () => {
    const { google, signIn } = setup();

    expect(signIn(google.issue('stranger@example.com'))).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('refuses a disabled user', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com', { enabled: false }));

    expect(signIn(google.issue('maria@example.com'))).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('sign-in: the configured initial administrator is bootstrapped once', () => {
  it('creates an enabled administrator entry on first sign-in', () => {
    const { google, users, signIn } = setup('admin@example.com');

    const result = signIn(google.issue('admin@example.com', { sub: 'sub-admin', name: 'Ada' }));

    expect(result).toEqual({
      ok: true,
      user: { email: 'admin@example.com', displayName: 'Ada', role: 'admin' },
    });
    expect(users.findByEmail('admin@example.com')).toEqual({
      email: 'admin@example.com',
      googleSubject: 'sub-admin',
      displayName: 'Ada',
      role: 'admin',
      enabled: true,
      createdAt: NOW,
    });
  });

  it('lets the allowlist override the configuration after bootstrap', () => {
    const { google, users, signIn } = setup('admin@example.com');
    users.add(member('admin@example.com', { role: 'admin', enabled: false }));

    expect(signIn(google.issue('admin@example.com'))).toEqual({ ok: false, error: 'forbidden' });
  });

  it('does not bootstrap anyone when no initial administrator is configured', () => {
    const { google, users, signIn } = setup('');

    expect(signIn(google.issue('admin@example.com'))).toEqual({ ok: false, error: 'forbidden' });
    expect(users.entries).toEqual([]);
  });
});

describe('sign-in: an allowlist entry is bound to one Google account', () => {
  it('remembers the Google account on first sign-in', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com'));

    signIn(google.issue('maria@example.com', { sub: 'sub-1' }));

    expect(users.findByEmail('maria@example.com')?.googleSubject).toBe('sub-1');
  });

  it('refuses a different Google account with the same email', () => {
    const { google, users, signIn } = setup();
    users.add(member('maria@example.com', { googleSubject: 'sub-1' }));

    expect(signIn(google.issue('maria@example.com', { sub: 'sub-2' }))).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });
});

describe('request handling', () => {
  it.each([
    ['malformed JSON', '{not json'],
    ['an unknown action', JSON.stringify({ action: 'dropTables', idToken: 'x' })],
    ['a missing token', JSON.stringify({ action: 'signIn' })],
  ])('rejects %s as a bad request', (_case, body) => {
    const { deps } = setup();

    expect(handleRequest(body, deps)).toEqual({ ok: false, error: 'bad_request' });
  });
});

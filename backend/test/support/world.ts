import { handleRequest, type BackendDeps, type BackendResponse } from '../../src/api';
import { openDb, type User } from '../../src/db';
import { InMemorySpreadsheet } from './in-memory-spreadsheet';

export const CLIENT_ID = 'gather-client.apps.googleusercontent.com';

export interface Claims {
  aud?: string;
  iss?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

/** Stands in for Google: issues ID tokens and answers tokeninfo for them. */
export class FakeGoogle {
  private readonly issued = new Map<string, Claims>();

  constructor(private readonly clock: () => Date) {}

  issue(email: string, overrides: Claims = {}): string {
    const token = `google-token-${this.issued.size + 1}`;
    this.issued.set(token, {
      aud: CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: this.clock().getTime() / 1000 + 3600,
      sub: `sub-${email.toLowerCase()}`,
      email,
      email_verified: 'true',
      name: email.split('@')[0],
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

/**
 * A complete backend with only its external boundaries replaced: the spreadsheet,
 * Google, the clock and ID generation.
 */
export class World {
  readonly spreadsheet = new InMemorySpreadsheet();
  now = new Date('2026-11-02T10:00:00Z');
  readonly google = new FakeGoogle(() => this.now);
  initialAdminEmail = 'admin@example.com';
  private nextId = 1;

  get deps(): BackendDeps {
    return {
      clientId: CLIENT_ID,
      initialAdminEmail: this.initialAdminEmail,
      now: () => this.now,
      newId: () => `id-${this.nextId++}`,
      fetchTokenInfo: this.google.tokenInfo,
      spreadsheet: this.spreadsheet,
    };
  }

  get db() {
    return openDb(this.spreadsheet);
  }

  request(body: unknown): BackendResponse {
    return handleRequest(JSON.stringify(body), this.deps);
  }

  /** Calls an action as the given (Google-verified) person. */
  as(email: string, action: string, payload: Record<string, unknown> = {}): BackendResponse {
    return this.request({ action, idToken: this.google.issue(email), ...payload });
  }

  /** Calls an action and returns its data, failing loudly if it was refused. */
  ok<T = unknown>(email: string, action: string, payload: Record<string, unknown> = {}): T {
    const response = this.as(email, action, payload);
    if (!response.ok) throw new Error(`${action} failed: ${response.error} ${response.message}`);
    return response.data as T;
  }

  addUser(email: string, overrides: Partial<User> = {}): User {
    const user: User = {
      userId: `user-${email}`,
      email,
      googleSubject: '',
      displayName: '',
      role: 'member',
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
    this.db.users.insert(user);
    return user;
  }

  user(email: string): User | undefined {
    return this.db.users.find((u) => u.email === email);
  }
}

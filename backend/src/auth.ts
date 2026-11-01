import type { Role, UserStore } from './users';

/** Claims of a Google ID token that the backend has verified itself. */
export interface VerifiedIdentity {
  subject: string;
  email: string;
  name: string;
}

export type SignInResult =
  | { ok: true; user: { email: string; displayName: string; role: Role } }
  | { ok: false; error: 'unauthenticated' | 'forbidden' };

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Verifies a Google ID token. Google's tokeninfo endpoint checks the signature
 * (Apps Script cannot verify RS256 itself); audience, issuer, expiry and email
 * verification are checked here. Returns undefined for any untrustworthy token.
 */
export function verifyIdToken(
  idToken: string,
  clientId: string,
  now: Date,
  fetchTokenInfo: (idToken: string) => { status: number; body: string },
): VerifiedIdentity | undefined {
  const response = fetchTokenInfo(idToken);
  if (response.status !== 200) return undefined;

  const claims = JSON.parse(response.body) as Record<string, string | undefined>;
  const valid =
    claims.aud === clientId &&
    GOOGLE_ISSUERS.includes(claims.iss ?? '') &&
    Number(claims.exp) * 1000 > now.getTime() &&
    claims.email_verified === 'true' &&
    Boolean(claims.sub) &&
    Boolean(claims.email);

  return valid
    ? { subject: claims.sub!, email: claims.email!.toLowerCase(), name: claims.name ?? '' }
    : undefined;
}

/** Authorizes a verified identity against the allowlist (spec §2, assumptions A5–A6). */
export function authorize(
  identity: VerifiedIdentity,
  users: UserStore,
  initialAdminEmail: string,
  now: Date,
): SignInResult {
  const entry = users.findByEmail(identity.email);

  if (!entry) {
    if (!initialAdminEmail || identity.email !== initialAdminEmail.toLowerCase()) {
      return { ok: false, error: 'forbidden' };
    }
    users.add({
      email: identity.email,
      googleSubject: identity.subject,
      displayName: identity.name,
      role: 'admin',
      enabled: true,
      createdAt: now,
    });
    return {
      ok: true,
      user: { email: identity.email, displayName: identity.name, role: 'admin' },
    };
  }

  if (!entry.enabled) return { ok: false, error: 'forbidden' };
  if (entry.googleSubject && entry.googleSubject !== identity.subject) {
    return { ok: false, error: 'forbidden' };
  }
  if (!entry.googleSubject) users.recordGoogleSubject(entry.email, identity.subject);

  return {
    ok: true,
    user: {
      email: entry.email,
      displayName: entry.displayName || identity.name,
      role: entry.role,
    },
  };
}

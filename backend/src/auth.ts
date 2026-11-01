import type { Context } from './context';
import type { User } from './db';
import { AppError } from './errors';

/** Claims of a Google ID token that the backend has verified itself. */
export interface VerifiedIdentity {
  subject: string;
  email: string;
  name: string;
}

export type FetchTokenInfo = (idToken: string) => { status: number; body: string };

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Verifies a Google ID token. Google's tokeninfo endpoint checks the signature
 * (Apps Script cannot verify RS256 itself); audience, issuer, expiry and email
 * verification are checked here (assumption A7).
 */
export function verifyIdToken(
  idToken: string,
  clientId: string,
  now: Date,
  fetchTokenInfo: FetchTokenInfo,
): VerifiedIdentity {
  const response = fetchTokenInfo(idToken);
  if (response.status !== 200) throw new AppError('unauthenticated');

  const claims = JSON.parse(response.body) as Record<string, string | undefined>;
  const valid =
    claims.aud === clientId &&
    GOOGLE_ISSUERS.includes(claims.iss ?? '') &&
    Number(claims.exp) * 1000 > now.getTime() &&
    claims.email_verified === 'true' &&
    Boolean(claims.sub) &&
    Boolean(claims.email);
  if (!valid) throw new AppError('unauthenticated');

  return { subject: claims.sub!, email: claims.email!.toLowerCase(), name: claims.name ?? '' };
}

/**
 * Finds the allowlisted user for a verified identity (spec §2, assumptions A5–A6),
 * bootstrapping the configured initial administrator and binding the Google account
 * on first sign-in.
 */
export function authorize(
  identity: VerifiedIdentity,
  initialAdminEmail: string,
  ctx: Context,
): User {
  const entry = ctx.db.users.find((u) => u.email === identity.email);

  if (!entry) {
    if (!initialAdminEmail || identity.email !== initialAdminEmail.trim().toLowerCase()) {
      throw new AppError('forbidden');
    }
    const admin: User = {
      userId: ctx.newId(),
      email: identity.email,
      googleSubject: identity.subject,
      displayName: identity.name,
      role: 'admin',
      enabled: true,
      createdAt: ctx.now.toISOString(),
    };
    ctx.db.users.insert(admin);
    return admin;
  }

  if (!entry.enabled) throw new AppError('forbidden');
  if (entry.googleSubject && entry.googleSubject !== identity.subject) {
    throw new AppError('forbidden');
  }
  if (!entry.googleSubject || !entry.displayName) {
    const bound = {
      ...entry,
      googleSubject: identity.subject,
      displayName: entry.displayName || identity.name,
    };
    ctx.db.users.replace((u) => u.userId === entry.userId, bound);
    return bound;
  }
  return entry;
}

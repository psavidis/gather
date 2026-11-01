export type ErrorCode =
  'bad_request' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'invalid';

/** An expected failure reported to the browser with a code and a human-readable message. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export type Payload = Record<string, unknown>;

export function text(payload: Payload, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string' || !value.trim())
    throw new AppError('invalid', `${field} is required`);
  return value.trim();
}

export function optionalText(payload: Payload, field: string): string {
  const value = payload[field];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new AppError('invalid', `${field} must be text`);
  return value.trim();
}

export function oneOf<T extends string>(payload: Payload, field: string, allowed: readonly T[]): T {
  const value = payload[field];
  if (!allowed.includes(value as T)) {
    throw new AppError('invalid', `${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function flag(payload: Payload, field: string): boolean {
  const value = payload[field];
  if (typeof value !== 'boolean') throw new AppError('invalid', `${field} must be true or false`);
  return value;
}

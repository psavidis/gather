import type { BackendResponse } from '../../backend/src/api';
import { config } from './config';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const UNREACHABLE = 'Gather could not reach its server. Please try again.';

/**
 * Calls an Apps Script action. The body is sent as text/plain so the browser
 * does not issue a CORS preflight, which Apps Script cannot answer (assumption A8).
 */
export async function callBackend<T>(
  action: string,
  payload: Record<string, unknown> = {},
  idToken?: string,
): Promise<T> {
  let body: BackendResponse<T>;
  try {
    const response = await fetch(config.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, ...payload }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = (await response.json()) as BackendResponse<T>;
  } catch {
    throw new ApiError('network', UNREACHABLE);
  }
  if (!body.ok) throw new ApiError(body.error, body.message);
  return body.data;
}

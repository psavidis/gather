import type { BackendResponse } from '../../backend/src/api';

export type { BackendResponse };

/**
 * Calls the Apps Script backend. The body is sent as text/plain so the browser
 * does not issue a CORS preflight, which Apps Script cannot answer (assumption A8).
 */
export async function signIn(backendUrl: string, idToken: string): Promise<BackendResponse> {
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'signIn', idToken }),
  });
  if (!response.ok) throw new Error(`Backend responded with HTTP ${response.status}`);
  return (await response.json()) as BackendResponse;
}

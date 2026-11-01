import { expect, test, type Page, type Request } from '@playwright/test';

/**
 * UI journeys for features/sign-in.feature. Google Identity Services and the
 * Apps Script backend are external services, so both are replaced at the
 * network boundary; the backend's rules are covered by backend/test.
 */
const BACKEND_URL = 'https://backend.e2e.test/exec';
const FAKE_GOOGLE_SCRIPT = `
  window.google = { accounts: { id: {
    initialize(options) { window.__gisCallback = options.callback; },
    renderButton(parent) {
      const button = document.createElement('button');
      button.textContent = 'Sign in with Google';
      button.onclick = () => window.__gisCallback({ credential: 'id-token-from-google' });
      parent.replaceChildren(button);
    },
  } } };
`;

type BackendReply = object | 'unreachable';

async function stubServices(page: Page, ...replies: BackendReply[]): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_GOOGLE_SCRIPT }),
  );
  await page.route(BACKEND_URL, (route) => {
    requests.push(route.request());
    const reply = replies.shift() ?? 'unreachable';
    return reply === 'unreachable'
      ? route.abort('connectionrefused')
      : route.fulfill({
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(reply),
        });
  });
  return requests;
}

async function signInWithGoogle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
}

test('an enabled member signs in', async ({ page }) => {
  const requests = await stubServices(page, {
    ok: true,
    user: { email: 'maria@example.com', displayName: 'Maria', role: 'member' },
  });

  await signInWithGoogle(page);

  await expect(
    page.getByText('Signed in as maria@example.com with the role member.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeHidden();
  expect(requests).toHaveLength(1);
  expect(requests[0].method()).toBe('POST');
  expect(requests[0].headers()['content-type']).toContain('text/plain');
  expect(requests[0].postDataJSON()).toEqual({ action: 'signIn', idToken: 'id-token-from-google' });
});

test('someone who is not on the allowlist is told they are not authorized', async ({ page }) => {
  await stubServices(page, { ok: false, error: 'forbidden' });

  await signInWithGoogle(page);

  await expect(page.getByRole('alert')).toHaveText(
    'Your account is not authorized to use Gather. Ask the administrator to add you.',
  );
});

test('an untrustworthy token leaves the user signed out', async ({ page }) => {
  await stubServices(page, { ok: false, error: 'unauthenticated' });

  await signInWithGoogle(page);

  await expect(page.getByRole('alert')).toContainText('You are not signed in');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('an unreachable backend is reported and sign-in can be retried', async ({ page }) => {
  await stubServices(page, 'unreachable', {
    ok: true,
    user: { email: 'maria@example.com', displayName: 'Maria', role: 'member' },
  });

  await signInWithGoogle(page);
  await expect(page.getByRole('alert')).toHaveText(
    'Sign-in failed because Gather could not reach its server. Please try again.',
  );

  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(
    page.getByText('Signed in as maria@example.com with the role member.'),
  ).toBeVisible();
});

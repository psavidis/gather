import { expect, test } from './support/fixtures';

test('an enabled member signs in', async ({ page, world, signIn }) => {
  world.addUser('maria@example.com');
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') requests.push(r.headers()['content-type'] ?? '');
  });

  await signIn('maria@example.com');

  await expect(
    page.getByText('Signed in as maria@example.com with the role member.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeHidden();
  expect(requests).toEqual([expect.stringContaining('text/plain')]);
});

test('someone who is not on the allowlist is told they are not authorized', async ({
  page,
  signIn,
}) => {
  await signIn('stranger@example.com');

  await expect(page.getByRole('alert')).toHaveText(
    'Your account is not authorized to use Gather. Ask the administrator to add you.',
  );
});

test('an untrustworthy token leaves the user signed out', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __googleCredential: string }).__googleCredential = 'forged';
  });
  await page.getByRole('button', { name: 'Sign in with Google' }).click();

  await expect(page.getByRole('alert')).toContainText('You are not signed in');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('an unreachable backend is reported and sign-in can be retried', async ({
  page,
  world,
  network,
  signIn,
}) => {
  world.addUser('maria@example.com');
  network.backendDown = true;

  await signIn('maria@example.com');
  await expect(page.getByRole('alert')).toHaveText(
    'Sign-in failed because Gather could not reach its server. Please try again.',
  );

  network.backendDown = false;
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(
    page.getByText('Signed in as maria@example.com with the role member.'),
  ).toBeVisible();
});

test('the initial administrator is bootstrapped on first sign-in', async ({ page, signIn }) => {
  await signIn('admin@example.com');

  await expect(page.getByText('Signed in as admin@example.com with the role admin.')).toBeVisible();
});

test('signing out returns to the sign-in screen', async ({ page, world, signIn }) => {
  world.addUser('maria@example.com');
  await signIn('maria@example.com');

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

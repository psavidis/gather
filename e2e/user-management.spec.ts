import { expect, test } from './support/fixtures';

test.beforeEach(async ({ page, signIn }) => {
  await signIn('admin@example.com');
  await page.getByRole('link', { name: 'Users' }).click();
});

test('the administrator adds a member who can then sign in', async ({ page, newPage, signIn }) => {
  await page.getByLabel('Email').fill('nikos@example.com');
  await page.getByRole('button', { name: 'Add user' }).click();

  await expect(page.getByRole('listitem', { name: 'nikos@example.com' })).toContainText(
    'member · enabled',
  );

  const nikos = await newPage();
  await signIn('nikos@example.com', nikos);
  await expect(nikos.getByText('with the role member')).toBeVisible();
});

test('a duplicate email is refused with an explanation', async ({ page, world }) => {
  world.addUser('maria@example.com');

  await page.getByLabel('Email').fill('Maria@Example.com');
  await page.getByRole('button', { name: 'Add user' }).click();

  await expect(page.getByRole('alert')).toHaveText('maria@example.com is already on the list');
});

test('the administrator disables, promotes and removes a user', async ({ page }) => {
  await page.getByLabel('Email').fill('maria@example.com');
  await page.getByRole('button', { name: 'Add user' }).click();
  const maria = page.getByRole('listitem', { name: 'maria@example.com' });

  await maria.getByRole('button', { name: 'Disable' }).click();
  await expect(maria).toContainText('member · disabled');

  await maria.getByRole('button', { name: 'Make admin' }).click();
  await expect(maria).toContainText('admin · disabled');

  page.once('dialog', (dialog) => dialog.accept());
  await maria.getByRole('button', { name: 'Remove' }).click();
  await expect(maria).toBeHidden();
});

test('the administrator cannot disable their own account', async ({ page }) => {
  await page
    .getByRole('listitem', { name: 'admin@example.com' })
    .getByRole('button', { name: 'Disable' })
    .click();

  await expect(page.getByRole('alert')).toHaveText('You cannot disable your own account');
});

test('members do not see user management', async ({ page, world, newPage, signIn }) => {
  world.addUser('maria@example.com');
  const maria = await newPage();

  await signIn('maria@example.com', maria);

  await expect(maria.getByText('with the role member')).toBeVisible();
  await expect(maria.getByRole('link', { name: 'Users' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
});

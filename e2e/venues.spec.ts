import { expect, test } from './support/fixtures';

const SIX_DOGS_URL =
  'https://www.google.com/maps/place/Six+d.o.g.s/@37.9768,23.7240,17z/data=!3m1!4b1!4m6!3m5!8m2!3d37.97695!4d23.72588';

test.beforeEach(async ({ page, signIn }) => {
  await signIn('admin@example.com');
  await page.getByRole('link', { name: 'Venues' }).click();
});

test('adding a venue from a Google Maps link', async ({ page }) => {
  await page.getByLabel('Google Maps link').fill(SIX_DOGS_URL);

  await expect(page.getByLabel('Name')).toHaveValue('Six d.o.g.s');
  await expect(page.getByLabel('Latitude')).toHaveValue('37.97695');
  await expect(page.getByLabel('Longitude')).toHaveValue('23.72588');

  await page.getByLabel('Category').selectOption('Bar');
  await page.getByRole('button', { name: 'Save venue' }).click();

  const venue = page.getByRole('listitem', { name: 'Six d.o.g.s' });
  await expect(venue).toContainText('Bar');
  await expect(venue.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    SIX_DOGS_URL,
  );
  await expect(page.getByLabel('Name')).toHaveValue('');
});

test('adding a venue by clicking the map', async ({ page }) => {
  await page.getByRole('region', { name: 'Venue map' }).click({ position: { x: 150, y: 120 } });

  await expect(page.getByLabel('Latitude')).not.toHaveValue('');
  await expect(page.getByLabel('Longitude')).not.toHaveValue('');

  await page.getByLabel('Name').fill('Noel');
  await page.getByLabel('Category').selectOption('Bar');
  await page.getByRole('button', { name: 'Save venue' }).click();

  await expect(page.getByRole('listitem', { name: 'Noel' })).toBeVisible();
});

test('a short Google Maps link asks for the full link or a map click', async ({ page }) => {
  await page.getByLabel('Google Maps link').fill('https://maps.app.goo.gl/AbCdEf123');

  await expect(page.getByRole('status')).toContainText("This link doesn't include a location");
  await expect(page.getByLabel('Google Maps link')).toHaveValue(
    'https://maps.app.goo.gl/AbCdEf123',
  );
});

test('a venue without a location is refused with an explanation', async ({ page }) => {
  await page.getByLabel('Name').fill('Nowhere');
  await page.getByLabel('Category').selectOption('Pub');
  await page.getByRole('button', { name: 'Save venue' }).click();

  await expect(page.getByRole('alert')).toHaveText('Set the location by clicking the map');
});

test('editing and disabling a venue', async ({ page, world }) => {
  await page.getByLabel('Google Maps link').fill(SIX_DOGS_URL);
  await page.getByLabel('Category').selectOption('Bar');
  await page.getByRole('button', { name: 'Save venue' }).click();
  const venue = page.getByRole('listitem', { name: 'Six d.o.g.s' });

  await venue.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Notes').fill('Book ahead on Fridays');
  await page.getByRole('button', { name: 'Save venue' }).click();
  await expect(venue).toContainText('Book ahead on Fridays');

  await venue.getByRole('button', { name: 'Disable' }).click();
  await expect(venue).toContainText('disabled');
  expect(world.db.venues.all()).toEqual([expect.objectContaining({ enabled: false })]);
});

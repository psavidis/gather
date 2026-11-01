import { beforeEach, describe, expect, it } from 'vitest';
import { World } from './support/world';

const ADMIN = 'admin@example.com';
const MEMBER = 'maria@example.com';
let world: World;

const noel = {
  name: 'Noel',
  category: 'bar',
  address: 'Kolokotroni 59B, Athens',
  latitude: 37.9772,
  longitude: 23.7303,
  googleMapsUrl: 'https://www.google.com/maps/place/Noel',
  rating: 4.6,
  priceRange: '€€',
  notes: '',
};

beforeEach(() => {
  world = new World();
  world.ok(ADMIN, 'signIn');
  world.addUser(MEMBER);
});

describe('venue catalog', () => {
  it('adds a venue that everyone can then see', () => {
    const added = world.ok<{ venueId: string }>(ADMIN, 'addVenue', noel);

    expect(world.ok(MEMBER, 'listVenues')).toEqual([
      { venueId: added.venueId, ...noel, enabled: true },
    ]);
  });

  it('accepts a venue with only a name, category and location', () => {
    world.ok(ADMIN, 'addVenue', { name: 'Kiosk', category: 'other', latitude: 1, longitude: 2 });

    expect(world.ok(MEMBER, 'listVenues')).toEqual([
      expect.objectContaining({ name: 'Kiosk', rating: null, priceRange: '', googleMapsUrl: '' }),
    ]);
  });

  it.each([
    [{ name: '' }, 'name is required'],
    [{ category: 'nightclub' }, 'category must be one of: restaurant, bar, pub, cafe, other'],
    [{ latitude: undefined }, 'Set the location by clicking the map'],
    [{ latitude: 91 }, 'latitude must be between -90 and 90'],
    [{ longitude: -181 }, 'longitude must be between -180 and 180'],
    [{ googleMapsUrl: 'javascript:alert(1)' }, 'Google Maps link must start with https://'],
    [{ rating: 6 }, 'rating must be between 0 and 5'],
    [{ priceRange: 'cheap' }, 'priceRange must be one of: , €, €€, €€€, €€€€'],
  ])('rejects invalid details %j', (change, message) => {
    expect(world.as(ADMIN, 'addVenue', { ...noel, ...change })).toEqual({
      ok: false,
      error: 'invalid',
      message,
    });
  });

  it('edits a venue', () => {
    const { venueId } = world.ok<{ venueId: string }>(ADMIN, 'addVenue', noel);

    world.ok(ADMIN, 'updateVenue', { venueId, ...noel, notes: 'Book ahead on Fridays' });

    expect(world.ok(MEMBER, 'listVenues')).toEqual([
      expect.objectContaining({ venueId, notes: 'Book ahead on Fridays' }),
    ]);
  });

  it('reports editing a venue that does not exist', () => {
    expect(world.as(ADMIN, 'updateVenue', { venueId: 'missing', ...noel })).toMatchObject({
      error: 'not_found',
    });
  });

  it('hides disabled venues from members but not from the administrator', () => {
    const { venueId } = world.ok<{ venueId: string }>(ADMIN, 'addVenue', noel);

    world.ok(ADMIN, 'updateVenue', { venueId, ...noel, enabled: false });

    expect(world.ok(MEMBER, 'listVenues')).toEqual([]);
    expect(world.ok(ADMIN, 'listVenues')).toEqual([
      expect.objectContaining({ venueId, enabled: false }),
    ]);
  });

  it.each(['addVenue', 'updateVenue'])('refuses %s to members', (action) => {
    expect(world.as(MEMBER, action, noel)).toMatchObject({ error: 'forbidden' });
  });
});

import type { World } from './world';

export const ADMIN = 'admin@example.com';
export const WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];

/** Adds Noel (bar) and Taverna (restaurant) to the catalog. */
export function seedVenues(world: World) {
  const add = (name: string, category: string, latitude: number) =>
    world.ok<{ venueId: string }>(ADMIN, 'addVenue', {
      name,
      category,
      address: `${name} street 1, Athens`,
      latitude,
      longitude: 23.73,
      googleMapsUrl: `https://www.google.com/maps/place/${name}`,
    }).venueId;
  return { noel: add('Noel', 'bar', 37.9772), taverna: add('Taverna', 'restaurant', 37.975) };
}

/**
 * A round for the week of 9 November 2026 in which Maria, Nikos and Eleni voted
 * and the administrator (Ada) did not. Leaves voting open.
 */
export function seedVotedRound(world: World) {
  world.now = new Date('2026-11-02T10:00:00Z');
  world.ok(ADMIN, 'signIn');
  world.db.users.replace((u) => u.email === ADMIN, { ...world.user(ADMIN)!, displayName: 'Ada' });
  world.addUser('maria@example.com', { displayName: 'Maria' });
  world.addUser('nikos@example.com', { displayName: 'Nikos' });
  world.addUser('eleni@example.com', { displayName: 'Eleni' });
  const { noel, taverna } = seedVenues(world);
  const { roundId } = world.ok<{ roundId: string }>(ADMIN, 'createRound', {
    week: WEEK[0],
    deadline: '2026-11-06T18:00:00.000Z',
  });
  world.ok(ADMIN, 'openRound', { roundId });

  const week = (...answers: string[]) => Object.fromEntries(WEEK.map((d, i) => [d, answers[i]]));
  const vote = (email: string, ballot: Record<string, unknown>) =>
    world.ok(email, 'submitVote', { roundId, venues: [], venuesFlexible: false, ...ballot });
  vote('maria@example.com', {
    availability: week('after_work', 'after_home', 'unavailable', 'flexible', 'after_work'),
    activity: 'drinks',
    location: 'home',
    locationArea: 'Pangrati',
    venues: [noel],
  });
  vote('nikos@example.com', {
    availability: week('after_home', 'after_home', 'unavailable', 'unavailable', 'after_work'),
    activity: 'food',
    location: 'office',
    venuesFlexible: true,
  });
  vote('eleni@example.com', {
    availability: week('after_work', 'unavailable', 'unavailable', 'after_home', 'flexible'),
    activity: 'both',
    location: 'central',
    venues: [noel, taverna],
  });
  return { roundId, noel, taverna };
}

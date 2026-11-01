import { beforeEach, describe, expect, it } from 'vitest';
import { World } from './support/world';

const ADMIN = 'admin@example.com';
const MARIA = 'maria@example.com';
const NIKOS = 'nikos@example.com';
const DAYS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
let world: World;
let roundId: string;
let noel: string;

const ballot = (overrides: Record<string, unknown> = {}) => ({
  roundId,
  availability: {
    '2026-11-09': 'after_work',
    '2026-11-10': 'after_home',
    '2026-11-11': 'unavailable',
    '2026-11-12': 'flexible',
    '2026-11-13': 'after_work',
  },
  activity: 'drinks',
  location: 'home',
  locationArea: 'Pangrati',
  venues: [noel],
  venuesFlexible: false,
  ...overrides,
});

interface Current {
  roundId: string;
  days: string[];
  status: string;
  participant: boolean;
  myVote: Record<string, unknown> | null;
}

beforeEach(() => {
  world = new World();
  world.now = new Date('2026-11-02T10:00:00Z');
  world.ok(ADMIN, 'signIn');
  world.addUser(MARIA);
  world.addUser(NIKOS);
  noel = world.ok<{ venueId: string }>(ADMIN, 'addVenue', {
    name: 'Noel',
    category: 'bar',
    latitude: 37.97,
    longitude: 23.73,
  }).venueId;
  roundId = world.ok<{ roundId: string }>(ADMIN, 'createRound', {
    week: '2026-11-09',
    deadline: '2026-11-06T18:00:00.000Z',
  }).roundId;
  world.ok(ADMIN, 'openRound', { roundId });
});

const current = (email = MARIA) => world.ok<Current | null>(email, 'getCurrentRound');

describe('the current round as seen by a member', () => {
  it('shows the open round and that the member has not voted yet', () => {
    expect(current()).toEqual({
      roundId,
      weekStart: '2026-11-09',
      days: DAYS,
      status: 'open',
      deadline: '2026-11-06T18:00:00.000Z',
      participant: true,
      myVote: null,
    });
  });

  it('shows nothing while the round is a draft', () => {
    const fresh = new World();
    fresh.ok(ADMIN, 'createRound', { week: '2026-11-09', deadline: '2026-11-06T18:00:00.000Z' });

    expect(fresh.ok(ADMIN, 'getCurrentRound')).toBeNull();
  });

  it('tells members added after opening that they are not participants', () => {
    world.addUser('eleni@example.com');

    expect(current('eleni@example.com')).toMatchObject({ participant: false, myVote: null });
  });

  it('includes only the member’s own vote', () => {
    world.ok(NIKOS, 'submitVote', ballot({ activity: 'food' }));

    expect(current(MARIA)?.myVote).toBeNull();
    expect(JSON.stringify(current(MARIA))).not.toContain('food');
  });
});

describe('submitting a vote', () => {
  it('saves the vote and returns it as the member’s vote', () => {
    world.ok(MARIA, 'submitVote', ballot());

    expect(current()?.myVote).toEqual({
      availability: ballot().availability,
      activity: 'drinks',
      location: 'home',
      locationArea: 'Pangrati',
      venues: [noel],
      venuesFlexible: false,
      submittedAt: world.now.toISOString(),
      updatedAt: world.now.toISOString(),
    });
  });

  it('records no venue preference when the venue step is skipped', () => {
    world.ok(MARIA, 'submitVote', ballot({ venues: [], venuesFlexible: false }));

    expect(current()?.myVote).toMatchObject({ venues: [], venuesFlexible: false });
  });

  it('drops the area for location choices that do not use it', () => {
    world.ok(MARIA, 'submitVote', ballot({ location: 'central', locationArea: 'Pangrati' }));

    expect(current()?.myVote).toMatchObject({ location: 'central', locationArea: '' });
  });

  it('updates an existing vote, keeping the original submission time', () => {
    world.ok(MARIA, 'submitVote', ballot());
    const submittedAt = world.now.toISOString();
    world.now = new Date('2026-11-03T09:00:00Z');

    world.ok(MARIA, 'submitVote', ballot({ activity: 'food' }));

    expect(current()?.myVote).toMatchObject({
      activity: 'food',
      submittedAt,
      updatedAt: world.now.toISOString(),
    });
    expect(world.db.votes.all()).toHaveLength(1);
  });

  it.each([
    [{ availability: { '2026-11-09': 'after_work' } }, 'Answer every day of the week'],
    [
      { availability: { ...ballot().availability, '2026-11-09': 'maybe' } },
      'availability must be one of: after_work, after_home, unavailable, flexible',
    ],
    [{ activity: 'karaoke' }, 'activity must be one of: drinks, food, both, flexible'],
    [
      { location: 'moon' },
      'location must be one of: office, home, central, anywhere, other, flexible',
    ],
    [{ venues: ['unknown'] }, 'Choose venues from the catalog'],
    [{ venuesFlexible: true }, 'Choose venues or no preference, not both'],
  ])('rejects %j', (change, message) => {
    expect(world.as(MARIA, 'submitVote', ballot(change))).toEqual({
      ok: false,
      error: 'invalid',
      message,
    });
  });

  it('refuses votes from users who are not in the snapshot', () => {
    world.addUser('eleni@example.com');

    expect(world.as('eleni@example.com', 'submitVote', ballot())).toMatchObject({
      error: 'forbidden',
      message: 'You are not a participant in this voting round',
    });
  });

  it('refuses votes after the deadline', () => {
    world.now = new Date('2026-11-06T18:00:00.000Z');

    expect(world.as(MARIA, 'submitVote', ballot())).toMatchObject({
      error: 'conflict',
      message: 'Voting is closed',
    });
  });
});

describe('automatic closure (A1, A12)', () => {
  const rounds = () =>
    world.ok<{ status: string; eligible: { email: string; voted: boolean }[] }[]>(
      ADMIN,
      'listRounds',
    );

  it('shows the administrator who has voted, without their answers', () => {
    world.ok(MARIA, 'submitVote', ballot());

    expect(rounds()[0].eligible).toEqual([
      expect.objectContaining({ email: ADMIN, voted: false }),
      expect.objectContaining({ email: MARIA, voted: true }),
      expect.objectContaining({ email: NIKOS, voted: false }),
    ]);
  });

  it('closes the round when the last participant votes', () => {
    world.ok(ADMIN, 'submitVote', ballot());
    world.ok(MARIA, 'submitVote', ballot());
    expect(rounds()[0].status).toBe('open');

    world.ok(NIKOS, 'submitVote', ballot());

    expect(rounds()[0].status).toBe('closed');
    expect(world.as(MARIA, 'submitVote', ballot())).toMatchObject({ message: 'Voting is closed' });
  });

  it('does not close again when votes are updated after a reopen', () => {
    for (const email of [ADMIN, MARIA, NIKOS]) world.ok(email, 'submitVote', ballot());
    world.ok(ADMIN, 'reopenRound', { roundId, deadline: '2026-11-06T18:00:00.000Z' });

    world.ok(MARIA, 'submitVote', ballot({ activity: 'food' }));

    expect(rounds()[0].status).toBe('open');
  });
});

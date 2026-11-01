import { beforeEach, describe, expect, it } from 'vitest';
import { World } from './support/world';

const ADMIN = 'admin@example.com';
const MEMBER = 'maria@example.com';
const DEADLINE = '2026-11-06T18:00:00.000Z';
let world: World;

interface RoundView {
  roundId: string;
  weekStart: string;
  days: string[];
  status: string;
  deadline: string;
  eligible: { email: string }[];
}

beforeEach(() => {
  world = new World();
  world.now = new Date('2026-11-02T10:00:00Z'); // Monday
  world.ok(ADMIN, 'signIn');
  world.addUser(MEMBER);
});

const create = (week = '2026-11-11', deadline = DEADLINE) =>
  world.ok<RoundView>(ADMIN, 'createRound', { week, deadline });
const rounds = () => world.ok<RoundView[]>(ADMIN, 'listRounds');
const openRound = () => {
  const { roundId } = create();
  world.ok(ADMIN, 'openRound', { roundId });
  return roundId;
};

describe('creating a round', () => {
  it('creates a draft for the working days of the week containing the chosen date', () => {
    const round = create('2026-11-11');

    expect(round).toMatchObject({
      weekStart: '2026-11-09',
      days: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'],
      status: 'draft',
      deadline: DEADLINE,
      eligible: [],
    });
    expect(rounds()).toEqual([round]);
  });

  it('treats a Sunday as part of the week that started the Monday before', () => {
    expect(create('2026-11-15')).toMatchObject({ weekStart: '2026-11-09' });
  });

  it('allows the current week', () => {
    expect(create('2026-11-04', '2026-11-03T18:00:00.000Z')).toMatchObject({
      weekStart: '2026-11-02',
    });
  });

  it.each([
    [{ week: '2026-10-28' }, 'That week has already ended'],
    [{ deadline: '2026-11-02T09:59:00.000Z' }, 'The deadline must be in the future'],
    [{ week: 'next week' }, 'week must be a date'],
    [{ deadline: 'tomorrow' }, 'deadline must be a date and time'],
  ])('refuses %j', (change, message) => {
    expect(
      world.as(ADMIN, 'createRound', { week: '2026-11-11', deadline: DEADLINE, ...change }),
    ).toEqual({ ok: false, error: 'invalid', message });
  });

  it('allows only one active round at a time', () => {
    create();

    expect(world.as(ADMIN, 'createRound', { week: '2026-11-18', deadline: DEADLINE })).toEqual({
      ok: false,
      error: 'conflict',
      message: 'Finish the current round before starting a new one',
    });
  });
});

describe('opening a round', () => {
  it('opens voting and snapshots the enabled users', () => {
    world.addUser('disabled@example.com', { enabled: false });

    openRound();

    expect(rounds()[0]).toMatchObject({
      status: 'open',
      eligible: [
        expect.objectContaining({ email: ADMIN }),
        expect.objectContaining({ email: MEMBER }),
      ],
    });
  });

  it('does not add users created after opening', () => {
    openRound();
    world.ok(ADMIN, 'addUser', { email: 'nikos@example.com', role: 'member' });

    expect(rounds()[0].eligible).toHaveLength(2);
  });

  it('refuses to open once the deadline has passed', () => {
    const { roundId } = create();
    world.now = new Date(DEADLINE);

    expect(world.as(ADMIN, 'openRound', { roundId })).toMatchObject({
      message: 'The deadline must be in the future',
    });
  });

  it('refuses to open a round that is not a draft', () => {
    const roundId = openRound();

    expect(world.as(ADMIN, 'openRound', { roundId })).toMatchObject({
      error: 'conflict',
      message: 'Only a draft round can be opened',
    });
  });
});

describe('closing and reopening', () => {
  it('closes automatically when the deadline is reached', () => {
    openRound();
    world.now = new Date(DEADLINE);

    expect(rounds()[0].status).toBe('closed');
  });

  it('closes manually', () => {
    const roundId = openRound();

    world.ok(ADMIN, 'closeRound', { roundId });

    expect(rounds()[0].status).toBe('closed');
  });

  it('reopens with a new deadline', () => {
    const roundId = openRound();
    world.now = new Date(DEADLINE);

    world.ok(ADMIN, 'reopenRound', { roundId, deadline: '2026-11-07T12:00:00.000Z' });

    expect(rounds()[0]).toMatchObject({ status: 'open', deadline: '2026-11-07T12:00:00.000Z' });
  });

  it('refuses to reopen with a deadline in the past', () => {
    const roundId = openRound();
    world.ok(ADMIN, 'closeRound', { roundId });

    expect(
      world.as(ADMIN, 'reopenRound', { roundId, deadline: '2026-11-01T12:00:00.000Z' }),
    ).toMatchObject({ message: 'The deadline must be in the future' });
  });

  it('refuses to close a round that is not open', () => {
    const { roundId } = create();

    expect(world.as(ADMIN, 'closeRound', { roundId })).toMatchObject({
      error: 'conflict',
      message: 'Only an open round can be closed',
    });
  });

  it('refuses to reopen a round that is not closed', () => {
    const roundId = openRound();

    expect(world.as(ADMIN, 'reopenRound', { roundId, deadline: DEADLINE })).toMatchObject({
      error: 'conflict',
      message: 'Only a closed round can be reopened',
    });
  });
});

describe('deleting a draft', () => {
  it('deletes a draft, allowing a new round', () => {
    const { roundId } = create();

    world.ok(ADMIN, 'deleteRound', { roundId });

    expect(rounds()).toEqual([]);
    expect(create()).toMatchObject({ status: 'draft' });
  });

  it('refuses to delete a round that has been opened', () => {
    const roundId = openRound();

    expect(world.as(ADMIN, 'deleteRound', { roundId })).toMatchObject({
      error: 'conflict',
      message: 'Only a draft round can be deleted',
    });
  });

  it('reports a round that does not exist', () => {
    expect(world.as(ADMIN, 'deleteRound', { roundId: 'missing' })).toMatchObject({
      error: 'not_found',
    });
  });
});

it.each(['createRound', 'listRounds', 'openRound', 'closeRound', 'reopenRound', 'deleteRound'])(
  'refuses %s to members',
  (action) => {
    expect(world.as(MEMBER, action, {})).toMatchObject({ error: 'forbidden' });
  },
);

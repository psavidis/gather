import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, seedVotedRound } from './support/scenarios';
import { World } from './support/world';

let world: World;
let roundId: string;
let noel: string;
let taverna: string;

const decision = (overrides: Record<string, unknown> = {}) => ({
  roundId,
  title: 'Team outing',
  date: '2026-11-09',
  time: '21:00',
  venueId: noel,
  alternative: 'Taverna if Noel is full',
  notes: 'First round is on the company',
  participantCount: 3,
  ...overrides,
});

const publish = (overrides: Record<string, unknown> = {}) =>
  world.ok<{ eventId: string }>(ADMIN, 'publishEvent', decision(overrides)).eventId;

const publicCall = (action: string, payload: Record<string, unknown> = {}) =>
  world.request({ action, ...payload });

beforeEach(() => {
  world = new World();
  ({ roundId, noel, taverna } = seedVotedRound(world));
  world.ok(ADMIN, 'closeRound', { roundId });
});

describe('publishing the decision', () => {
  it('creates a public event page with only public details', () => {
    const eventId = publish();

    expect(publicCall('getPublicEvent', { eventId })).toEqual({
      ok: true,
      data: {
        eventId,
        title: 'Team outing',
        date: '2026-11-09',
        time: '21:00',
        venue: {
          name: 'Noel',
          address: 'Noel street 1, Athens',
          latitude: 37.9772,
          longitude: 23.73,
          googleMapsUrl: 'https://www.google.com/maps/place/Noel',
        },
        alternative: 'Taverna if Noel is full',
        notes: 'First round is on the company',
        participantCount: 3,
        status: 'upcoming',
      },
    });
  });

  it('records the decision, who made it and when, and marks the round published', () => {
    publish();

    expect(world.db.events.all()).toEqual([
      expect.objectContaining({
        roundId,
        publishedBy: world.user(ADMIN)!.userId,
        publishedAt: world.now.toISOString(),
      }),
    ]);
    expect(world.ok<{ status: string; eventId: string }[]>(ADMIN, 'listRounds')[0]).toMatchObject({
      status: 'published',
      eventId: world.db.events.all()[0].eventId,
    });
  });

  it('allows a decision that differs from the top recommendation', () => {
    const eventId = publish({ date: '2026-11-13', time: '20:00', venueId: taverna });

    expect(publicCall('getPublicEvent', { eventId })).toMatchObject({
      data: { date: '2026-11-13', time: '20:00', venue: { name: 'Taverna' } },
    });
  });

  it('defaults the title and leaves optional details empty', () => {
    const eventId = publish({ title: '', alternative: '', notes: '', participantCount: null });

    expect(publicCall('getPublicEvent', { eventId })).toMatchObject({
      data: { title: 'Team outing', alternative: '', notes: '', participantCount: null },
    });
  });

  it('keeps the venue details as they were when published', () => {
    const eventId = publish();
    const venue = world.db.venues.find((v) => v.venueId === noel)!;
    world.db.venues.replace((v) => v.venueId === noel, { ...venue, name: 'Noel (renamed)' });

    expect(publicCall('getPublicEvent', { eventId })).toMatchObject({
      data: { venue: { name: 'Noel' } },
    });
  });

  it.each([
    [{ date: '2026-11-16' }, 'invalid', "Choose one of the round's days"],
    [{ time: '9pm' }, 'invalid', 'time must be a time like 21:00'],
    [{ venueId: 'unknown' }, 'invalid', 'Choose a venue from the catalog'],
    [{ participantCount: -1 }, 'invalid', 'participantCount must be between 0 and 1000'],
  ])('rejects %j', (change, error, message) => {
    expect(world.as(ADMIN, 'publishEvent', decision(change))).toEqual({
      ok: false,
      error,
      message,
    });
  });

  it('requires voting to be closed', () => {
    world.ok(ADMIN, 'reopenRound', { roundId, deadline: '2026-11-06T18:00:00.000Z' });

    expect(world.as(ADMIN, 'publishEvent', decision())).toMatchObject({
      error: 'conflict',
      message: 'Close voting before publishing',
    });
  });

  it('publishes a round only once', () => {
    publish();

    expect(world.as(ADMIN, 'publishEvent', decision())).toMatchObject({
      error: 'conflict',
      message: 'Close voting before publishing',
    });
  });

  it('frees the way for a new round', () => {
    publish();

    expect(
      world.as(ADMIN, 'createRound', { week: '2026-11-16', deadline: '2026-11-13T18:00:00.000Z' }),
    ).toMatchObject({ ok: true });
  });

  it('is refused to members', () => {
    expect(world.as('maria@example.com', 'publishEvent', decision())).toMatchObject({
      error: 'forbidden',
    });
  });
});

describe('public pages', () => {
  it('never expose private information', () => {
    const eventId = publish();
    const exposed = JSON.stringify([
      publicCall('getPublicEvent', { eventId }),
      publicCall('listPublicEvents'),
    ]);

    for (const secret of [
      '@example.com',
      'Maria',
      'Pangrati',
      roundId,
      world.user(ADMIN)!.userId,
      'after_work',
      'publishedBy',
    ]) {
      expect(exposed).not.toContain(secret);
    }
  });

  it('lists published outings, newest first, as upcoming until their date has passed (A3)', () => {
    const first = publish();
    world.now = new Date('2026-11-10T09:00:00Z');
    const { roundId: next } = world.ok<{ roundId: string }>(ADMIN, 'createRound', {
      week: '2026-11-16',
      deadline: '2026-11-13T18:00:00.000Z',
    });
    world.ok(ADMIN, 'openRound', { roundId: next });
    world.ok(ADMIN, 'closeRound', { roundId: next });
    const second = world.ok<{ eventId: string }>(ADMIN, 'publishEvent', {
      roundId: next,
      date: '2026-11-19',
      time: '18:30',
      venueId: taverna,
    }).eventId;

    expect(publicCall('listPublicEvents')).toEqual({
      ok: true,
      data: [
        {
          eventId: second,
          title: 'Team outing',
          date: '2026-11-19',
          time: '18:30',
          venueName: 'Taverna',
          status: 'upcoming',
        },
        {
          eventId: first,
          title: 'Team outing',
          date: '2026-11-09',
          time: '21:00',
          venueName: 'Noel',
          status: 'past',
        },
      ],
    });
  });

  it('counts the event day itself as upcoming', () => {
    const eventId = publish();
    world.now = new Date('2026-11-09T23:00:00Z');

    expect(publicCall('getPublicEvent', { eventId })).toMatchObject({
      data: { status: 'upcoming' },
    });
  });

  it('reports an unknown event', () => {
    expect(publicCall('getPublicEvent', { eventId: 'missing' })).toMatchObject({
      error: 'not_found',
    });
  });
});

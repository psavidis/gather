import { beforeEach, describe, expect, it } from 'vitest';
import type { Report } from '../src/report';
import { World } from './support/world';

const ADMIN = 'admin@example.com';
let world: World;
let roundId: string;
let noel: string;
let taverna: string;

const DAYS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const week = (...answers: string[]) => Object.fromEntries(DAYS.map((d, i) => [d, answers[i]]));

function vote(email: string, ballot: Record<string, unknown>) {
  world.ok(email, 'submitVote', { roundId, venuesFlexible: false, venues: [], ...ballot });
}

beforeEach(() => {
  world = new World();
  world.now = new Date('2026-11-02T10:00:00Z');
  world.ok(ADMIN, 'signIn', {});
  world.db.users.replace((u) => u.email === ADMIN, { ...world.user(ADMIN)!, displayName: 'Ada' });
  world.addUser('maria@example.com', { displayName: 'Maria' });
  world.addUser('nikos@example.com', { displayName: 'Nikos' });
  world.addUser('eleni@example.com', { displayName: 'Eleni' });
  const venue = (name: string, category: string) =>
    world.ok<{ venueId: string }>(ADMIN, 'addVenue', { name, category, latitude: 1, longitude: 1 })
      .venueId;
  noel = venue('Noel', 'bar');
  taverna = venue('Taverna', 'restaurant');
  roundId = world.ok<{ roundId: string }>(ADMIN, 'createRound', {
    week: '2026-11-09',
    deadline: '2026-11-06T18:00:00.000Z',
  }).roundId;
  world.ok(ADMIN, 'openRound', { roundId });

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
});

const close = () => world.ok(ADMIN, 'closeRound', { roundId });
const report = (window?: { windowStart: string; windowEnd: string }) =>
  world.ok<Report>(ADMIN, 'getReport', { roundId, ...window });

describe('results report', () => {
  beforeEach(close);

  it('summarises participation and names the missing responses', () => {
    expect(report().participation).toEqual({
      eligible: 4,
      submitted: 3,
      missing: 1,
      percentage: 75,
      missingNames: ['Ada'],
    });
  });

  it('counts availability per day, keeping missing responses separate', () => {
    expect(report().availability[0]).toEqual({
      date: '2026-11-09',
      afterWork: 2,
      afterHome: 1,
      unavailable: 0,
      flexible: 0,
      missing: 1,
      availableAt1830: 2,
      availableAt2100: 3,
    });
    expect(report().availability[4]).toMatchObject({ availableAt1830: 2, flexible: 1 });
  });

  it('counts availability in a custom window (A2)', () => {
    const { window } = report({ windowStart: '19:00', windowEnd: '22:00' });

    expect(window?.days[0]).toEqual({
      date: '2026-11-09',
      fromStart: 2,
      joiningLater: [{ time: '21:00', count: 1 }],
      notInWindow: 0,
      unavailable: 0,
      flexible: 0,
      missing: 1,
    });
  });

  it('counts arrivals at or after the end of the window as not in the window', () => {
    const { window } = report({ windowStart: '18:00', windowEnd: '21:00' });

    expect(window?.days[0]).toMatchObject({
      fromStart: 0,
      joiningLater: [{ time: '18:30', count: 2 }],
      notInWindow: 1,
    });
  });

  it.each([
    [{ windowStart: '22:00', windowEnd: '19:00' }, 'The window must end after it starts'],
    [{ windowStart: '7pm', windowEnd: '22:00' }, 'windowStart must be a time like 19:00'],
  ])('rejects the window %j', (window, message) => {
    expect(world.as(ADMIN, 'getReport', { roundId, ...window })).toMatchObject({ message });
  });

  it('breaks down activity, location and venue preferences', () => {
    expect(report().preferences).toEqual({
      activity: { drinks: 1, food: 1, both: 1, flexible: 0 },
      location: { office: 1, home: 1, central: 1, anywhere: 0, other: 0, flexible: 0 },
      areas: ['Pangrati'],
      venues: [
        { venueId: noel, name: 'Noel', votes: 2 },
        { venueId: taverna, name: 'Taverna', votes: 1 },
      ],
      venuesFlexible: 1,
      venuesSkipped: 0,
    });
  });

  it('ranks recommendations with a transparent score (A13)', () => {
    const top = report().recommendations.slice(0, 5);

    expect(top.map((r) => [r.date, r.time, r.venueName, r.score])).toEqual([
      ['2026-11-09', '21:00', 'Noel', 14],
      ['2026-11-09', '21:00', 'Taverna', 13],
      ['2026-11-13', '18:30', 'Noel', 12],
      ['2026-11-13', '21:00', 'Noel', 12],
      ['2026-11-09', '18:30', 'Noel', 11],
    ]);
    expect(top[0]).toMatchObject({
      available: 3,
      flexible: 0,
      venuePicks: 2,
      activityMatches: 1,
      explanation:
        '3 available × 3 + 0 flexible × 1 + 2 venue picks × 2 + 1 activity match × 1 = 14',
      activities: { drinks: 1, food: 1, both: 1, flexible: 0 },
      locations: { office: 1, home: 1, central: 1, anywhere: 0, other: 0, flexible: 0 },
    });
  });

  it('returns at most 10 recommendations and drops options nobody can attend', () => {
    const { recommendations } = report();

    expect(recommendations).toHaveLength(10);
    expect(recommendations.some((r) => r.date === '2026-11-11')).toBe(false);
  });

  it('recommends dates and times without venues when the catalog is empty', () => {
    for (const venueId of [noel, taverna]) {
      world.db.venues.replace((v) => v.venueId === venueId, {
        ...world.db.venues.find((v) => v.venueId === venueId)!,
        enabled: false,
      });
    }

    expect(report().recommendations[0]).toMatchObject({
      date: '2026-11-09',
      time: '21:00',
      venueId: null,
      venueName: null,
      score: 9,
    });
  });
});

describe('access to the report', () => {
  it('is available only after voting closes', () => {
    expect(world.as(ADMIN, 'getReport', { roundId })).toMatchObject({
      error: 'conflict',
      message: 'The report is available once voting has closed',
    });
  });

  it('is refused to members', () => {
    close();
    expect(world.as('maria@example.com', 'getReport', { roundId })).toMatchObject({
      error: 'forbidden',
    });
  });
});

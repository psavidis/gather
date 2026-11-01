import type { Action } from './context';
import {
  ACTIVITIES,
  LOCATIONS,
  type Activity,
  type Availability,
  type LocationPreference,
  type Round,
  type Venue,
  type Vote,
} from './db';
import { AppError, optionalText, type Payload } from './errors';
import { findRound, statusOf } from './rounds';

/** When each availability answer means a person can arrive (spec §3.2). */
const ARRIVAL: Partial<Record<Availability, string>> = {
  after_work: '18:30',
  after_home: '21:00',
};
const TIMES = ['18:30', '21:00'] as const;

/** Venue categories that suit each activity preference (assumption A13). */
const ACTIVITY_VENUES: Record<Activity, Venue['category'][]> = {
  drinks: ['bar', 'pub', 'cafe'],
  food: ['restaurant', 'pub', 'cafe'],
  both: ['restaurant', 'pub'],
  flexible: [],
};

const WEIGHTS = { available: 3, flexible: 1, venuePicks: 2, activityMatches: 1 };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function tally<T extends string>(keys: readonly T[], values: T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const value of values) counts[value]++;
  return counts;
}

const plural = (count: number, word: string, suffix = 's') =>
  `${count} ${word}${count === 1 ? '' : suffix}`;

function participation(round: Round, votes: Vote[]) {
  const voters = new Set(votes.map((v) => v.userId));
  const missing = round.eligible.filter((p) => !voters.has(p.userId));
  const eligible = round.eligible.length;
  return {
    eligible,
    submitted: votes.length,
    missing: missing.length,
    percentage: eligible === 0 ? 0 : Math.round((votes.length / eligible) * 100),
    missingNames: missing.map((p) => p.displayName || p.email),
  };
}

function availability(round: Round, votes: Vote[], missing: number) {
  return round.days.map((date) => {
    const answers = tally(
      ['after_work', 'after_home', 'unavailable', 'flexible'] as const,
      votes.map((v) => v.availability[date]),
    );
    return {
      date,
      afterWork: answers.after_work,
      afterHome: answers.after_home,
      unavailable: answers.unavailable,
      flexible: answers.flexible,
      missing,
      availableAt1830: answers.after_work,
      availableAt2100: answers.after_work + answers.after_home,
    };
  });
}

/** Availability within a custom time window (assumption A2). */
function windowAvailability(
  round: Round,
  votes: Vote[],
  missing: number,
  start: string,
  end: string,
) {
  return {
    start,
    end,
    days: round.days.map((date) => {
      const arrivals = votes.map((v) => ARRIVAL[v.availability[date]]).filter(Boolean) as string[];
      const later = arrivals.filter((time) => time > start && time < end);
      return {
        date,
        fromStart: arrivals.filter((time) => time <= start).length,
        joiningLater: TIMES.filter((time) => later.includes(time)).map((time) => ({
          time,
          count: later.filter((t) => t === time).length,
        })),
        notInWindow: arrivals.filter((time) => time >= end).length,
        unavailable: votes.filter((v) => v.availability[date] === 'unavailable').length,
        flexible: votes.filter((v) => v.availability[date] === 'flexible').length,
        missing,
      };
    }),
  };
}

function preferences(votes: Vote[], venues: Venue[]) {
  const picks = votes.flatMap((v) => v.venues);
  return {
    activity: tally(
      ACTIVITIES,
      votes.map((v) => v.activity),
    ),
    location: tally(
      LOCATIONS,
      votes.map((v) => v.location),
    ),
    areas: [...new Set(votes.map((v) => v.locationArea).filter(Boolean))].sort(),
    venues: venues
      .map((venue) => ({
        venueId: venue.venueId,
        name: venue.name,
        votes: picks.filter((id) => id === venue.venueId).length,
      }))
      .filter((v) => v.votes > 0)
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name)),
    venuesFlexible: votes.filter((v) => v.venuesFlexible).length,
    venuesSkipped: votes.filter((v) => !v.venuesFlexible && v.venues.length === 0).length,
  };
}

/** Ranked date/time/venue options with their score breakdown (assumption A13). */
function recommendations(round: Round, votes: Vote[], venues: Venue[]) {
  const options = venues.length > 0 ? venues : [null];
  const candidates = round.days.flatMap((date) =>
    TIMES.flatMap((time) => {
      const available = votes.filter((v) => (ARRIVAL[v.availability[date]] ?? '99:99') <= time);
      const flexible = votes.filter((v) => v.availability[date] === 'flexible');
      const counted = [...available, ...flexible];
      if (counted.length === 0) return [];

      return options.map((venue) => {
        const venuePicks = venue
          ? counted.filter((v) => v.venues.includes(venue.venueId)).length
          : 0;
        const activityMatches = venue
          ? counted.filter((v) => ACTIVITY_VENUES[v.activity].includes(venue.category)).length
          : 0;
        const score =
          WEIGHTS.available * available.length +
          WEIGHTS.flexible * flexible.length +
          WEIGHTS.venuePicks * venuePicks +
          WEIGHTS.activityMatches * activityMatches;
        return {
          date,
          time,
          venueId: venue?.venueId ?? null,
          venueName: venue?.name ?? null,
          available: available.length,
          flexible: flexible.length,
          venuePicks,
          activityMatches,
          score,
          explanation:
            `${available.length} available × ${WEIGHTS.available} + ` +
            `${flexible.length} flexible × ${WEIGHTS.flexible} + ` +
            `${plural(venuePicks, 'venue pick')} × ${WEIGHTS.venuePicks} + ` +
            `${plural(activityMatches, 'activity match', 'es')} × ${WEIGHTS.activityMatches} = ${score}`,
          activities: tally(
            ACTIVITIES,
            counted.map((v) => v.activity),
          ),
          locations: tally(
            LOCATIONS,
            counted.map((v) => v.location as LocationPreference),
          ),
        };
      });
    }),
  );

  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.available - a.available ||
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        (a.venueName ?? '').localeCompare(b.venueName ?? ''),
    )
    .slice(0, 10);
}

function timeWindow(payload: Payload): { start: string; end: string } | undefined {
  const start = optionalText(payload, 'windowStart');
  const end = optionalText(payload, 'windowEnd');
  if (!start && !end) return undefined;
  for (const [field, value] of [
    ['windowStart', start],
    ['windowEnd', end],
  ]) {
    if (!TIME.test(value)) throw new AppError('invalid', `${field} must be a time like 19:00`);
  }
  if (end <= start) throw new AppError('invalid', 'The window must end after it starts');
  return { start, end };
}

export function buildReport(round: Round, votes: Vote[], venues: Venue[], payload: Payload) {
  const window = timeWindow(payload);
  const summary = participation(round, votes);
  return {
    roundId: round.roundId,
    days: round.days,
    participation: summary,
    availability: availability(round, votes, summary.missing),
    window: window
      ? windowAvailability(round, votes, summary.missing, window.start, window.end)
      : null,
    preferences: preferences(votes, venues),
    recommendations: recommendations(round, votes, venues),
  };
}

export type Report = ReturnType<typeof buildReport>;

/** The administrator's results report (spec §6). Never computed while voting is open. */
export const reportActions: Record<string, Action> = {
  getReport: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      const status = statusOf(round, ctx.now);
      if (status !== 'closed' && status !== 'published') {
        throw new AppError('conflict', 'The report is available once voting has closed');
      }
      const eligible = new Set(round.eligible.map((p) => p.userId));
      const votes = ctx.db.votes
        .all()
        .filter((v) => v.roundId === round.roundId && eligible.has(v.userId));
      const venues = ctx.db.venues.all().filter((v) => v.enabled);
      return buildReport(round, votes, venues, payload);
    },
  },
};

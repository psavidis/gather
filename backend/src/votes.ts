import type { Action, SignedInContext } from './context';
import {
  ACTIVITIES,
  AVAILABILITY,
  LOCATIONS,
  type Availability,
  type Round,
  type Vote,
} from './db';
import { AppError, flag, oneOf, optionalText, type Payload } from './errors';
import { findRound, statusOf } from './rounds';

const AREA_LOCATIONS = ['home', 'other'];

/** The member's own vote, as shown back to them. Other people's votes are never returned. */
const ownVote = (vote: Vote) => ({
  availability: vote.availability,
  activity: vote.activity,
  location: vote.location,
  locationArea: vote.locationArea,
  venues: vote.venues,
  venuesFlexible: vote.venuesFlexible,
  submittedAt: vote.submittedAt,
  updatedAt: vote.updatedAt,
});

export type OwnVote = ReturnType<typeof ownVote>;

/** Rounds that members can see: voting is open or has closed but not yet been published. */
function currentRound(ctx: SignedInContext): Round | undefined {
  return ctx.db.rounds.find((r) => r.status === 'open' || r.status === 'closed');
}

function availability(payload: Payload, round: Round): Record<string, Availability> {
  const given = payload.availability;
  if (typeof given !== 'object' || given === null) {
    throw new AppError('invalid', 'Answer every day of the week');
  }
  const answers = given as Record<string, unknown>;
  return Object.fromEntries(
    round.days.map((day) => {
      if (answers[day] === undefined) throw new AppError('invalid', 'Answer every day of the week');
      return [day, oneOf({ availability: answers[day] }, 'availability', AVAILABILITY)];
    }),
  );
}

function venues(
  ctx: SignedInContext,
  payload: Payload,
): { venues: string[]; venuesFlexible: boolean } {
  const chosen = payload.venues ?? [];
  const enabled = new Set(
    ctx.db.venues
      .all()
      .filter((v) => v.enabled)
      .map((v) => v.venueId),
  );
  if (!Array.isArray(chosen) || !chosen.every((id) => typeof id === 'string' && enabled.has(id))) {
    throw new AppError('invalid', 'Choose venues from the catalog');
  }
  const venuesFlexible =
    payload.venuesFlexible === undefined ? false : flag(payload, 'venuesFlexible');
  if (venuesFlexible && chosen.length > 0) {
    throw new AppError('invalid', 'Choose venues or no preference, not both');
  }
  return { venues: [...new Set(chosen as string[])], venuesFlexible };
}

export type CurrentRound = NonNullable<ReturnType<typeof describeCurrent>>;

function describeCurrent(ctx: SignedInContext) {
  const round = currentRound(ctx);
  if (!round) return null;
  const vote = ctx.db.votes.find(
    (v) => v.roundId === round.roundId && v.userId === ctx.user.userId,
  );
  return {
    roundId: round.roundId,
    weekStart: round.weekStart,
    days: round.days,
    status: statusOf(round, ctx.now),
    deadline: round.deadline,
    participant: round.eligible.some((p) => p.userId === ctx.user.userId),
    myVote: vote ? ownVote(vote) : null,
  };
}

/** Member voting (spec §3.2, §5; assumptions A1, A12). */
export const voteActions: Record<string, Action> = {
  getCurrentRound: {
    access: 'member',
    run: describeCurrent,
  },

  submitVote: {
    access: 'member',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      if (!round.eligible.some((p) => p.userId === ctx.user.userId)) {
        throw new AppError('forbidden', 'You are not a participant in this voting round');
      }
      if (statusOf(round, ctx.now) !== 'open') throw new AppError('conflict', 'Voting is closed');

      const location = oneOf(payload, 'location', LOCATIONS);
      const answers = {
        availability: availability(payload, round),
        activity: oneOf(payload, 'activity', ACTIVITIES),
        location,
        locationArea: AREA_LOCATIONS.includes(location)
          ? optionalText(payload, 'locationArea').slice(0, 80)
          : '',
        ...venues(ctx, payload),
      };

      const isMine = (v: Vote) => v.roundId === round.roundId && v.userId === ctx.user.userId;
      const previous = ctx.db.votes.find(isMine);
      const now = ctx.now.toISOString();
      if (previous) {
        const updated: Vote = { ...previous, ...answers, updatedAt: now };
        ctx.db.votes.replace(isMine, updated);
        return ownVote(updated);
      }

      const vote: Vote = {
        voteId: ctx.newId(),
        roundId: round.roundId,
        userId: ctx.user.userId,
        ...answers,
        submittedAt: now,
        updatedAt: now,
      };
      ctx.db.votes.insert(vote);
      closeIfEveryoneVoted(ctx, round);
      return ownVote(vote);
    },
  },
};

function closeIfEveryoneVoted(ctx: SignedInContext, round: Round) {
  const voters = new Set(
    ctx.db.votes
      .all()
      .filter((v) => v.roundId === round.roundId)
      .map((v) => v.userId),
  );
  if (round.eligible.every((p) => voters.has(p.userId))) {
    ctx.db.rounds.replace((r) => r.roundId === round.roundId, { ...round, status: 'closed' });
  }
}

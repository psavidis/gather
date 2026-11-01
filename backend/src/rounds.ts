import type { Action, Context, SignedInContext } from './context';
import { addDays, isDate, mondayOf, today } from './dates';
import type { Round } from './db';
import { AppError, text, type Payload } from './errors';

export type RoundStatus = Round['status'];

/**
 * The status a round actually has now: an open round whose deadline has passed
 * is closed, whether or not anything has recorded that yet (assumption A4).
 */
export function statusOf(round: Round, now: Date): RoundStatus {
  return round.status === 'open' && now.getTime() >= Date.parse(round.deadline)
    ? 'closed'
    : round.status;
}

export const isActive = (round: Round) => round.status !== 'published';

export function findRound(ctx: Context, payload: Payload): Round {
  const roundId = text(payload, 'roundId');
  const round = ctx.db.rounds.find((r) => r.roundId === roundId);
  if (!round) throw new AppError('not_found', 'Voting round not found');
  return round;
}

function futureDeadline(ctx: Context, payload: Payload): string {
  const value = text(payload, 'deadline');
  const time = Date.parse(value);
  if (!value.includes('T') || Number.isNaN(time)) {
    throw new AppError('invalid', 'deadline must be a date and time');
  }
  if (time <= ctx.now.getTime())
    throw new AppError('invalid', 'The deadline must be in the future');
  return new Date(time).toISOString();
}

function save(ctx: Context, round: Round) {
  ctx.db.rounds.replace((r) => r.roundId === round.roundId, round);
}

function requireStatus(ctx: Context, round: Round, status: RoundStatus, verb: string) {
  if (statusOf(round, ctx.now) !== status) {
    throw new AppError(
      'conflict',
      `Only ${status === 'open' ? 'an' : 'a'} ${status} round can be ${verb}`,
    );
  }
}

/** The administrator's view of a round, including who is eligible. */
export function roundView(ctx: SignedInContext, round: Round) {
  const voters = new Set(
    ctx.db.votes
      .all()
      .filter((v) => v.roundId === round.roundId)
      .map((v) => v.userId),
  );
  return {
    roundId: round.roundId,
    weekStart: round.weekStart,
    days: round.days,
    status: statusOf(round, ctx.now),
    deadline: round.deadline,
    createdAt: round.createdAt,
    eligible: round.eligible.map((p) => ({ ...p, voted: voters.has(p.userId) })),
    eventId: ctx.db.events.find((e) => e.roundId === round.roundId)?.eventId ?? null,
  };
}

export type RoundView = ReturnType<typeof roundView>;

/** Round lifecycle (spec §3.1, §5; assumptions A4, A11, A12). */
export const roundActions: Record<string, Action> = {
  listRounds: {
    access: 'admin',
    run: (ctx) =>
      ctx.db.rounds
        .all()
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
        .map((round) => roundView(ctx, round)),
  },

  createRound: {
    access: 'admin',
    run: (ctx, payload) => {
      const week = text(payload, 'week');
      if (!isDate(week)) throw new AppError('invalid', 'week must be a date');
      const weekStart = mondayOf(week);
      if (addDays(weekStart, 6) < today(ctx.now)) {
        throw new AppError('invalid', 'That week has already ended');
      }
      const deadline = futureDeadline(ctx, payload);
      if (ctx.db.rounds.find(isActive)) {
        throw new AppError('conflict', 'Finish the current round before starting a new one');
      }
      const round: Round = {
        roundId: ctx.newId(),
        weekStart,
        days: [0, 1, 2, 3, 4].map((offset) => addDays(weekStart, offset)),
        status: 'draft',
        deadline,
        createdBy: ctx.user.userId,
        createdAt: ctx.now.toISOString(),
        eligible: [],
      };
      ctx.db.rounds.insert(round);
      return roundView(ctx, round);
    },
  },

  openRound: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      requireStatus(ctx, round, 'draft', 'opened');
      if (Date.parse(round.deadline) <= ctx.now.getTime()) {
        throw new AppError('invalid', 'The deadline must be in the future');
      }
      const eligible = ctx.db.users
        .all()
        .filter((u) => u.enabled)
        .map(({ userId, email, displayName }) => ({ userId, email, displayName }));
      const opened: Round = { ...round, status: 'open', eligible };
      save(ctx, opened);
      return roundView(ctx, opened);
    },
  },

  closeRound: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      requireStatus(ctx, round, 'open', 'closed');
      const closed: Round = { ...round, status: 'closed' };
      save(ctx, closed);
      return roundView(ctx, closed);
    },
  },

  reopenRound: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      requireStatus(ctx, round, 'closed', 'reopened');
      const reopened: Round = { ...round, status: 'open', deadline: futureDeadline(ctx, payload) };
      save(ctx, reopened);
      return roundView(ctx, reopened);
    },
  },

  deleteRound: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      requireStatus(ctx, round, 'draft', 'deleted');
      ctx.db.rounds.remove((r) => r.roundId === round.roundId);
      return null;
    },
  },
};

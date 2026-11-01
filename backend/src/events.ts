import type { Action, Context } from './context';
import { today } from './dates';
import type { OutingEvent } from './db';
import { AppError, optionalNumberIn, optionalText, text } from './errors';
import { findRound, statusOf } from './rounds';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The only shape in which an event leaves the backend publicly (spec §8).
 * It deliberately lists each field: nothing private can leak by accident.
 */
function publicEvent(ctx: Context, event: OutingEvent) {
  return {
    eventId: event.eventId,
    title: event.title,
    date: event.date,
    time: event.time,
    venue: {
      name: event.venue.name,
      address: event.venue.address,
      latitude: event.venue.latitude,
      longitude: event.venue.longitude,
      googleMapsUrl: event.venue.googleMapsUrl,
    },
    alternative: event.alternative,
    notes: event.notes,
    participantCount: event.participantCount,
    status: archiveStatus(ctx, event),
  };
}

export type PublicEvent = ReturnType<typeof publicEvent>;

/** Upcoming until the event's date has passed, then part of the past archive (assumption A3). */
const archiveStatus = (ctx: Context, event: OutingEvent) =>
  event.date < today(ctx.now) ? ('past' as const) : ('upcoming' as const);

const summary = (ctx: Context, event: OutingEvent) => ({
  eventId: event.eventId,
  title: event.title,
  date: event.date,
  time: event.time,
  venueName: event.venue.name,
  status: archiveStatus(ctx, event),
});

export type EventSummary = ReturnType<typeof summary>;

/** Final decision, publication and the public archive (spec §7, §8; assumption A14). */
export const eventActions: Record<string, Action> = {
  publishEvent: {
    access: 'admin',
    run: (ctx, payload) => {
      const round = findRound(ctx, payload);
      if (statusOf(round, ctx.now) !== 'closed') {
        throw new AppError('conflict', 'Close voting before publishing');
      }
      const date = text(payload, 'date');
      if (!round.days.includes(date))
        throw new AppError('invalid', "Choose one of the round's days");
      const time = text(payload, 'time');
      if (!TIME.test(time)) throw new AppError('invalid', 'time must be a time like 21:00');
      const venueId = optionalText(payload, 'venueId');
      const venue = ctx.db.venues.find((v) => v.venueId === venueId && v.enabled);
      if (!venue) throw new AppError('invalid', 'Choose a venue from the catalog');

      const event: OutingEvent = {
        eventId: ctx.newId(),
        roundId: round.roundId,
        title: optionalText(payload, 'title') || 'Team outing',
        date,
        time,
        venueId,
        venue: {
          name: venue.name,
          address: venue.address,
          latitude: venue.latitude,
          longitude: venue.longitude,
          googleMapsUrl: venue.googleMapsUrl,
        },
        alternative: optionalText(payload, 'alternative'),
        notes: optionalText(payload, 'notes'),
        participantCount: optionalNumberIn(payload, 'participantCount', 0, 1000),
        publishedAt: ctx.now.toISOString(),
        publishedBy: ctx.user.userId,
      };
      ctx.db.events.insert(event);
      ctx.db.rounds.replace((r) => r.roundId === round.roundId, { ...round, status: 'published' });
      return publicEvent(ctx, event);
    },
  },

  getPublicEvent: {
    access: 'public',
    run: (ctx, payload) => {
      const eventId = text(payload, 'eventId');
      const event = ctx.db.events.find((e) => e.eventId === eventId);
      if (!event) throw new AppError('not_found', 'This outing does not exist');
      return publicEvent(ctx, event);
    },
  },

  listPublicEvents: {
    access: 'public',
    run: (ctx) =>
      ctx.db.events
        .all()
        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
        .map((event) => summary(ctx, event)),
  },
};

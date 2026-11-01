import type { Action } from './context';
import { PRICE_RANGES, VENUE_CATEGORIES, type Venue } from './db';
import {
  AppError,
  numberIn,
  oneOf,
  optionalNumberIn,
  optionalText,
  text,
  type Payload,
} from './errors';

/** Reads and validates the editable venue details (spec §4, assumption A10). */
function details(payload: Payload): Omit<Venue, 'venueId' | 'enabled'> {
  const name = text(payload, 'name');
  const category = oneOf(payload, 'category', VENUE_CATEGORIES);
  if (payload.latitude == null || payload.longitude == null) {
    throw new AppError('invalid', 'Set the location by clicking the map');
  }
  const latitude = numberIn(payload, 'latitude', -90, 90);
  const longitude = numberIn(payload, 'longitude', -180, 180);
  const googleMapsUrl = optionalText(payload, 'googleMapsUrl');
  if (googleMapsUrl && !googleMapsUrl.startsWith('https://')) {
    throw new AppError('invalid', 'Google Maps link must start with https://');
  }
  return {
    name,
    category,
    address: optionalText(payload, 'address'),
    latitude,
    longitude,
    googleMapsUrl,
    rating: optionalNumberIn(payload, 'rating', 0, 5),
    priceRange: payload.priceRange ? oneOf(payload, 'priceRange', PRICE_RANGES) : '',
    notes: optionalText(payload, 'notes'),
  };
}

export const venueActions: Record<string, Action> = {
  /** Members see the venues they can vote for; the administrator sees the whole catalog. */
  listVenues: {
    access: 'member',
    run: (ctx) => {
      const venues = ctx.db.venues.all();
      return ctx.user.role === 'admin' ? venues : venues.filter((v) => v.enabled);
    },
  },

  addVenue: {
    access: 'admin',
    run: (ctx, payload) => {
      const venue: Venue = { venueId: ctx.newId(), ...details(payload), enabled: true };
      ctx.db.venues.insert(venue);
      return venue;
    },
  },

  updateVenue: {
    access: 'admin',
    run: (ctx, payload) => {
      const venueId = text(payload, 'venueId');
      const current = ctx.db.venues.find((v) => v.venueId === venueId);
      if (!current) throw new AppError('not_found', 'Venue not found');
      const venue: Venue = {
        venueId,
        ...details(payload),
        enabled: payload.enabled === undefined ? current.enabled : payload.enabled === true,
      };
      ctx.db.venues.replace((v) => v.venueId === venueId, venue);
      return venue;
    },
  },
};

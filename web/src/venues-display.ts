import type { Venue } from '../../backend/src/db';

export const CATEGORY_LABELS: Record<Venue['category'], string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  pub: 'Pub',
  cafe: 'Cafe',
  other: 'Other social venue',
};

/** A Google Maps directions link built from coordinates: a plain URL, no API key needed. */
export const directionsUrl = (venue: Pick<Venue, 'latitude' | 'longitude'>) =>
  `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;

export function summary(venue: Venue): string {
  return [
    CATEGORY_LABELS[venue.category],
    venue.priceRange,
    venue.rating === null ? '' : `★ ${venue.rating}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

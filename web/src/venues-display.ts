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

/** What the map needs to show a place: catalog venues and published event venues. */
export type MapVenue = Pick<Venue, 'venueId' | 'name' | 'address' | 'latitude' | 'longitude'> &
  Partial<
    Pick<Venue, 'category' | 'rating' | 'priceRange' | 'notes' | 'enabled' | 'googleMapsUrl'>
  >;

export function summary(venue: MapVenue): string {
  return [
    venue.category && CATEGORY_LABELS[venue.category],
    venue.priceRange,
    venue.rating == null ? '' : `★ ${venue.rating}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

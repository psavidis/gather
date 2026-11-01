export interface VenueHints {
  name?: string;
  latitude?: number;
  longitude?: number;
}

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PLACE_COORDINATES = new RegExp(`!3d${NUMBER}!4d${NUMBER}`);
const MAP_POSITION = new RegExp(`@${NUMBER},${NUMBER}`);
const COORDINATE_PAIR = new RegExp(`^${NUMBER},\\s*${NUMBER}$`);

/**
 * Extracts what a full Google Maps link reveals about a place, without calling
 * any Google API (assumption A10). Short links reveal nothing.
 */
export function parseGoogleMapsUrl(url: string): VenueHints {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {};
  }
  if (!/(^|\.)google\.[a-z.]+$/.test(parsed.hostname) || !url.includes('maps')) return {};

  const hints: VenueHints = {};
  const place = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
  if (place) hints.name = decodeURIComponent(place[1].replace(/\+/g, ' '));

  const coordinates =
    url.match(PLACE_COORDINATES) ??
    url.match(MAP_POSITION) ??
    ['q', 'query', 'll']
      .map((key) => parsed.searchParams.get(key)?.match(COORDINATE_PAIR))
      .find(Boolean);
  if (coordinates) {
    hints.latitude = Number(coordinates[1]);
    hints.longitude = Number(coordinates[2]);
  }
  return hints;
}

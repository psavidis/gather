import { describe, expect, it } from 'vitest';
import { parseGoogleMapsUrl } from '../src/google-maps-url';

describe('reading venue details from a Google Maps link', () => {
  it('reads the place name and exact coordinates from a place link', () => {
    const url =
      'https://www.google.com/maps/place/Six+d.o.g.s/@37.9768,23.7240,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d37.97695!4d23.72588!16s';

    expect(parseGoogleMapsUrl(url)).toEqual({
      name: 'Six d.o.g.s',
      latitude: 37.97695,
      longitude: 23.72588,
    });
  });

  it('decodes encoded characters in the place name', () => {
    expect(
      parseGoogleMapsUrl(
        'https://www.google.com/maps/place/Caf%C3%A9+Avissinia/@37.976,23.723,17z',
      ),
    ).toMatchObject({ name: 'Café Avissinia' });
  });

  it('falls back to the map position when the link has no exact place coordinates', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/@37.9715,-23.7257,15z')).toEqual({
      latitude: 37.9715,
      longitude: -23.7257,
    });
  });

  it.each([
    'https://www.google.com/maps?q=37.97,23.72',
    'https://www.google.com/maps/search/?api=1&query=37.97%2C23.72',
    'https://maps.google.com/?ll=37.97,23.72',
  ])('reads coordinates from the query of %s', (url) => {
    expect(parseGoogleMapsUrl(url)).toEqual({ latitude: 37.97, longitude: 23.72 });
  });

  it.each(['https://maps.app.goo.gl/AbCdEf123', 'https://example.com/not-a-map', 'not a url'])(
    'finds nothing in %s',
    (url) => {
      expect(parseGoogleMapsUrl(url)).toEqual({});
    },
  );
});

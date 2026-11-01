import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PRICE_RANGES, VENUE_CATEGORIES, type Venue } from '../../backend/src/db';
import { parseGoogleMapsUrl } from './google-maps-url';
import { useSession } from './session';
import { VenueMap, type LatLng } from './VenueMap';
import { CATEGORY_LABELS, summary } from './venues-display';

interface Draft {
  venueId?: string;
  name: string;
  category: Venue['category'] | '';
  address: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  rating: string;
  priceRange: Venue['priceRange'];
  notes: string;
}

const EMPTY: Draft = {
  name: '',
  category: '',
  address: '',
  latitude: '',
  longitude: '',
  googleMapsUrl: '',
  rating: '',
  priceRange: '',
  notes: '',
};

const NO_LOCATION_IN_LINK =
  "This link doesn't include a location. Paste the full link from your browser's address bar, or click the map to place the venue.";

const toDraft = (v: Venue): Draft => ({
  ...v,
  latitude: String(v.latitude),
  longitude: String(v.longitude),
  rating: v.rating === null ? '' : String(v.rating),
});

const number = (value: string) => (value.trim() === '' ? null : Number(value));

export function Venues() {
  const { call } = useSession();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string>();
  const [hint, setHint] = useState<string>();

  const reload = useCallback(
    () => call<Venue[]>('listVenues').then(setVenues, (e: Error) => setProblem(e.message)),
    [call],
  );
  useEffect(() => void reload(), [reload]);

  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }));

  function pasteLink(googleMapsUrl: string) {
    const hints = parseGoogleMapsUrl(googleMapsUrl);
    set({
      googleMapsUrl,
      ...(hints.name && !draft.name ? { name: hints.name } : {}),
      ...(hints.latitude !== undefined
        ? { latitude: String(hints.latitude), longitude: String(hints.longitude) }
        : {}),
    });
    setHint(googleMapsUrl && hints.latitude === undefined ? NO_LOCATION_IN_LINK : undefined);
  }

  function pick({ latitude, longitude }: LatLng) {
    set({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) });
    setHint(undefined);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    try {
      await call(draft.venueId ? 'updateVenue' : 'addVenue', {
        ...draft,
        latitude: number(draft.latitude),
        longitude: number(draft.longitude),
        rating: number(draft.rating),
      });
      setDraft(EMPTY);
      setHint(undefined);
      await reload();
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  async function setEnabled(venue: Venue, enabled: boolean) {
    setProblem(undefined);
    try {
      await call('updateVenue', { ...venue, enabled });
      await reload();
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  const picked =
    draft.latitude && draft.longitude
      ? { latitude: Number(draft.latitude), longitude: Number(draft.longitude) }
      : undefined;

  return (
    <section>
      <h2>Venues</h2>
      <VenueMap venues={venues} picked={picked} onPick={pick} />

      <form onSubmit={save} aria-label={draft.venueId ? 'Edit venue' : 'Add venue'}>
        <h3>{draft.venueId ? `Edit ${draft.name}` : 'Add a venue'}</h3>
        <p className="muted">Paste a Google Maps link, or click the map to place the venue.</p>
        <div className="form-grid">
          <label className="wide">
            Google Maps link
            <input
              type="url"
              value={draft.googleMapsUrl}
              onChange={(e) => pasteLink(e.target.value)}
            />
          </label>
          {hint && (
            <p className="wide" role="status">
              {hint}
            </p>
          )}
          <label>
            Name
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) => set({ category: e.target.value as Venue['category'] })}
            >
              <option value="">Choose…</option>
              {VENUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Address
            <input value={draft.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label>
            Latitude
            <input
              inputMode="decimal"
              value={draft.latitude}
              onChange={(e) => set({ latitude: e.target.value })}
            />
          </label>
          <label>
            Longitude
            <input
              inputMode="decimal"
              value={draft.longitude}
              onChange={(e) => set({ longitude: e.target.value })}
            />
          </label>
          <label>
            Rating (0–5)
            <input
              inputMode="decimal"
              value={draft.rating}
              onChange={(e) => set({ rating: e.target.value })}
            />
          </label>
          <label>
            Price range
            <select
              value={draft.priceRange}
              onChange={(e) => set({ priceRange: e.target.value as Venue['priceRange'] })}
            >
              {PRICE_RANGES.map((p) => (
                <option key={p} value={p}>
                  {p || 'Not specified'}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Notes
            <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>
        {problem && <p role="alert">{problem}</p>}
        <div className="actions">
          <button type="submit" className="primary">
            Save venue
          </button>
          {draft.venueId && (
            <button type="button" onClick={() => setDraft(EMPTY)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <h3>Catalog</h3>
      {venues.length === 0 && <p className="muted">No venues yet.</p>}
      <ul className="cards" aria-label="Venue catalog">
        {venues.map((venue) => (
          <li key={venue.venueId} aria-label={venue.name}>
            <div>
              <strong>{venue.name}</strong>{' '}
              {!venue.enabled && <span className="tag">disabled</span>}
            </div>
            <div className="muted">{summary(venue)}</div>
            {venue.address && <div>{venue.address}</div>}
            {venue.notes && <div className="muted">{venue.notes}</div>}
            <div className="actions">
              {venue.googleMapsUrl && (
                <a href={venue.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  Google Maps
                </a>
              )}
              <button onClick={() => setDraft(toDraft(venue))}>Edit</button>
              <button onClick={() => void setEnabled(venue, !venue.enabled)}>
                {venue.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

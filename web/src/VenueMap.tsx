import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Venue } from '../../backend/src/db';
import { directionsUrl, summary } from './venues-display';

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  venues: Venue[];
  selected?: ReadonlySet<string>;
  onToggle?: (venueId: string) => void;
  picked?: LatLng;
  onPick?: (location: LatLng) => void;
}

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Interactive Leaflet + OpenStreetMap map of venues (spec §4). No API key required. */
export function VenueMap({ venues, selected, onToggle, picked, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map>(null);
  const markers = useRef<L.LayerGroup>(null);
  const callbacks = useRef({ onToggle, onPick });
  useEffect(() => {
    callbacks.current = { onToggle, onPick };
  }, [onToggle, onPick]);

  useEffect(() => {
    const instance = L.map(container.current!, { scrollWheelZoom: false }).setView([20, 0], 2);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    instance.on('click', (e: L.LeafletMouseEvent) =>
      callbacks.current.onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }),
    );
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  const venueCount = venues.length;
  useEffect(() => {
    if (!map.current || venueCount === 0) return;
    const bounds = L.latLngBounds(venues.map((v) => [v.latitude, v.longitude]));
    map.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    // Refit only when venues are added or removed, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueCount]);

  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    for (const venue of venues) {
      const isSelected = selected?.has(venue.venueId) ?? false;
      L.circleMarker([venue.latitude, venue.longitude], {
        radius: isSelected ? 10 : 8,
        color: '#ffffff',
        weight: 2,
        fillColor: !venue.enabled ? '#8c959f' : isSelected ? '#1a7f37' : '#0b6bcb',
        fillOpacity: 0.95,
      })
        .bindTooltip(venue.name)
        .bindPopup(() => popup(venue, isSelected, callbacks.current.onToggle))
        .addTo(layer);
    }
    if (picked) {
      L.circleMarker([picked.latitude, picked.longitude], {
        radius: 9,
        color: '#b42318',
        fillColor: '#f85149',
        fillOpacity: 0.9,
      }).addTo(layer);
    }
  }, [venues, selected, picked]);

  return <div ref={container} className="venue-map" role="region" aria-label="Venue map" />;
}

/** Popup content built from DOM nodes so venue text is never interpreted as HTML. */
function popup(venue: Venue, isSelected: boolean, onToggle?: (venueId: string) => void) {
  const root = document.createElement('div');
  const add = (tag: string, content: string) => {
    const element = document.createElement(tag);
    element.textContent = content;
    root.appendChild(element);
    return element;
  };
  add('strong', venue.name);
  add('div', summary(venue));
  if (venue.address) add('div', venue.address);
  if (venue.notes) add('div', venue.notes).className = 'muted';
  const links = add('div', '');
  links.className = 'actions';
  const link = (label: string, url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    links.appendChild(a);
  };
  if (venue.googleMapsUrl) link('Google Maps', venue.googleMapsUrl);
  link('Directions', directionsUrl(venue));
  if (onToggle) {
    const button = document.createElement('button');
    button.textContent = isSelected ? 'Remove from my picks' : 'Add to my picks';
    button.onclick = () => onToggle(venue.venueId);
    root.appendChild(button);
  }
  return root;
}

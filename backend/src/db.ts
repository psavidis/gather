import { Table, type Codec, type Spreadsheet } from './spreadsheet';

export type Role = 'admin' | 'member';

export interface User {
  userId: string;
  email: string;
  googleSubject: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

const bool = (value: boolean) => (value ? 'TRUE' : 'FALSE');
const parseBool = (cell: string) => cell.trim().toUpperCase() === 'TRUE';

const userCodec: Codec<User> = {
  columns: ['userId', 'email', 'googleSubject', 'displayName', 'role', 'enabled', 'createdAt'],
  toRow: (u) => [
    u.userId,
    u.email,
    u.googleSubject,
    u.displayName,
    u.role,
    bool(u.enabled),
    u.createdAt,
  ],
  fromRow: ([userId, email, googleSubject, displayName, role, enabled, createdAt]) => ({
    userId,
    email: email.trim().toLowerCase(),
    googleSubject,
    displayName,
    role: role.trim() === 'admin' ? 'admin' : 'member',
    enabled: parseBool(enabled),
    createdAt,
  }),
};

export const VENUE_CATEGORIES = ['restaurant', 'bar', 'pub', 'cafe', 'other'] as const;
export const PRICE_RANGES = ['', '€', '€€', '€€€', '€€€€'] as const;

export interface Venue {
  venueId: string;
  name: string;
  category: (typeof VENUE_CATEGORIES)[number];
  address: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  rating: number | null;
  priceRange: (typeof PRICE_RANGES)[number];
  notes: string;
  enabled: boolean;
}

const venueCodec: Codec<Venue> = {
  columns: [
    'venueId',
    'name',
    'category',
    'address',
    'latitude',
    'longitude',
    'googleMapsUrl',
    'rating',
    'priceRange',
    'notes',
    'enabled',
  ],
  toRow: (v) => [
    v.venueId,
    v.name,
    v.category,
    v.address,
    String(v.latitude),
    String(v.longitude),
    v.googleMapsUrl,
    v.rating === null ? '' : String(v.rating),
    v.priceRange,
    v.notes,
    bool(v.enabled),
  ],
  fromRow: (row) => {
    const [venueId, name, category, address, latitude, longitude, googleMapsUrl] = row;
    const [rating, priceRange, notes, enabled] = row.slice(7);
    return {
      venueId,
      name,
      category: category as Venue['category'],
      address,
      latitude: Number(latitude),
      longitude: Number(longitude),
      googleMapsUrl,
      rating: rating ? Number(rating) : null,
      priceRange: priceRange as Venue['priceRange'],
      notes,
      enabled: parseBool(enabled),
    };
  },
};

/** Table name → codec; also defines each sheet's header row. */
export const SCHEMA = {
  Users: userCodec,
  Venues: venueCodec,
} as const;

export type Db = ReturnType<typeof openDb>;

export function openDb(sheet: Spreadsheet) {
  return {
    users: new Table(sheet, 'Users', SCHEMA.Users),
    venues: new Table(sheet, 'Venues', SCHEMA.Venues),
  };
}

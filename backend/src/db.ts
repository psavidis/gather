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

export type StoredRoundStatus = 'draft' | 'open' | 'closed' | 'published';

export interface Participant {
  userId: string;
  email: string;
  displayName: string;
}

export interface Round {
  roundId: string;
  weekStart: string;
  days: string[];
  status: StoredRoundStatus;
  deadline: string;
  createdBy: string;
  createdAt: string;
  eligible: Participant[];
}

const roundCodec: Codec<Round> = {
  columns: [
    'roundId',
    'weekStart',
    'days',
    'status',
    'deadline',
    'createdBy',
    'createdAt',
    'eligible',
  ],
  toRow: (r) => [
    r.roundId,
    r.weekStart,
    JSON.stringify(r.days),
    r.status,
    r.deadline,
    r.createdBy,
    r.createdAt,
    JSON.stringify(r.eligible),
  ],
  fromRow: ([roundId, weekStart, days, status, deadline, createdBy, createdAt, eligible]) => ({
    roundId,
    weekStart,
    days: JSON.parse(days || '[]') as string[],
    status: status as StoredRoundStatus,
    deadline,
    createdBy,
    createdAt,
    eligible: JSON.parse(eligible || '[]') as Participant[],
  }),
};

export const AVAILABILITY = ['after_work', 'after_home', 'unavailable', 'flexible'] as const;
export const ACTIVITIES = ['drinks', 'food', 'both', 'flexible'] as const;
export const LOCATIONS = ['office', 'home', 'central', 'anywhere', 'other', 'flexible'] as const;

export type Availability = (typeof AVAILABILITY)[number];
export type Activity = (typeof ACTIVITIES)[number];
export type LocationPreference = (typeof LOCATIONS)[number];

export interface Vote {
  voteId: string;
  roundId: string;
  userId: string;
  availability: Record<string, Availability>;
  activity: Activity;
  location: LocationPreference;
  locationArea: string;
  venues: string[];
  venuesFlexible: boolean;
  submittedAt: string;
  updatedAt: string;
}

const voteCodec: Codec<Vote> = {
  columns: [
    'voteId',
    'roundId',
    'userId',
    'availability',
    'activity',
    'location',
    'locationArea',
    'venues',
    'venuesFlexible',
    'submittedAt',
    'updatedAt',
  ],
  toRow: (v) => [
    v.voteId,
    v.roundId,
    v.userId,
    JSON.stringify(v.availability),
    v.activity,
    v.location,
    v.locationArea,
    JSON.stringify(v.venues),
    bool(v.venuesFlexible),
    v.submittedAt,
    v.updatedAt,
  ],
  fromRow: (row) => {
    const [voteId, roundId, userId, availability, activity, location, locationArea] = row;
    const [venues, venuesFlexible, submittedAt, updatedAt] = row.slice(7);
    return {
      voteId,
      roundId,
      userId,
      availability: JSON.parse(availability || '{}') as Vote['availability'],
      activity: activity as Activity,
      location: location as LocationPreference,
      locationArea,
      venues: JSON.parse(venues || '[]') as string[],
      venuesFlexible: parseBool(venuesFlexible),
      submittedAt,
      updatedAt,
    };
  },
};

/** Table name → codec; also defines each sheet's header row. */
export const SCHEMA = {
  Users: userCodec,
  Venues: venueCodec,
  Rounds: roundCodec,
  Votes: voteCodec,
} as const;

export type Db = ReturnType<typeof openDb>;

export function openDb(sheet: Spreadsheet) {
  return {
    users: new Table(sheet, 'Users', SCHEMA.Users),
    venues: new Table(sheet, 'Venues', SCHEMA.Venues),
    rounds: new Table(sheet, 'Rounds', SCHEMA.Rounds),
    votes: new Table(sheet, 'Votes', SCHEMA.Votes),
  };
}

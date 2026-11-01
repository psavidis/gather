import type { Activity, Availability, LocationPreference } from '../../backend/src/db';

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  after_work: 'After work — 18:30',
  after_home: 'After going home first — 21:00',
  unavailable: 'Unavailable',
  flexible: 'No preference / Flexible',
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  drinks: 'Drinks',
  food: 'Food',
  both: 'Both food and drinks',
  flexible: 'No preference / Flexible',
};

export const LOCATION_LABELS: Record<LocationPreference, string> = {
  office: 'Near the office',
  home: 'Near home',
  central: 'Central area',
  anywhere: 'Anywhere convenient',
  other: 'Another preferred area',
  flexible: 'No preference / Flexible',
};

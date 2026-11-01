const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const LONG_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** `2026-11-09` → `Mon 9 Nov` */
export const formatDay = (date: string) => DAY.format(new Date(`${date}T00:00:00Z`));

/** `2026-11-09` → `Monday 9 November 2026` */
export const formatLongDay = (date: string) => LONG_DAY.format(new Date(`${date}T00:00:00Z`));

/** An ISO instant in the viewer's time zone, e.g. `Fri 6 Nov, 18:00`. */
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));

/** The value of a `datetime-local` input (viewer's time zone) as an ISO instant. */
export const localInputToIso = (value: string) => (value ? new Date(value).toISOString() : '');

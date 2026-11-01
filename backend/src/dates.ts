/** Calendar dates as `YYYY-MM-DD` strings, computed in UTC so they never shift by time zone. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDate(value: string): boolean {
  return DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export const today = (now: Date) => now.toISOString().slice(0, 10);

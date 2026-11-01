import type { Report } from '../../backend/src/report';
import { formatDay } from './format';
import { ACTIVITY_LABELS, LOCATION_LABELS } from './labels';

export function counts<K extends string>(values: Record<K, number>, labels: Record<K, string>) {
  return (Object.keys(values) as K[])
    .filter((key) => values[key] > 0)
    .map((key) => `${labels[key]} ${values[key]}`)
    .join(', ');
}

export const weekLabel = (days: string[]) =>
  `${formatDay(days[0])} – ${formatDay(days[days.length - 1])}`;

/**
 * A plain-text version of the report for pasting into an AI assistant (spec §9).
 * It contains counts only — never participants' names.
 */
export function reportText(report: Report): string {
  const { participation: p, preferences: prefs } = report;
  const lines = [
    `Team outing — voting results for the week of ${weekLabel(report.days)}`,
    `Participation: ${p.submitted} of ${p.eligible} voted (${p.percentage}%), ${p.missing} no response.`,
    '',
    'Availability per day (at 18:30 / at 21:00 / no preference / unavailable / no response):',
    ...report.availability.map(
      (d) =>
        `- ${formatDay(d.date)}: ${d.availableAt1830} / ${d.availableAt2100} / ${d.flexible} / ${d.unavailable} / ${d.missing}`,
    ),
  ];
  if (report.window) {
    lines.push(
      '',
      `Availability ${report.window.start}–${report.window.end} (from the start / joining later / no preference):`,
      ...report.window.days.map(
        (d) =>
          `- ${formatDay(d.date)}: ${d.fromStart} / ${
            d.joiningLater.map((j) => `${j.count} at ${j.time}`).join(', ') || '0'
          } / ${d.flexible}`,
      ),
    );
  }
  lines.push(
    '',
    `Activity: ${counts(prefs.activity, ACTIVITY_LABELS) || 'none'}`,
    `Location: ${counts(prefs.location, LOCATION_LABELS) || 'none'}${
      prefs.areas.length ? `; areas mentioned: ${prefs.areas.join(', ')}` : ''
    }`,
    `Venue votes: ${prefs.venues.map((v) => `${v.name} ${v.votes}`).join(', ') || 'none'}; no venue preference ${prefs.venuesFlexible}; skipped ${prefs.venuesSkipped}`,
    '',
    'Top options (score = 3 × available + 1 × flexible + 2 × venue picks + 1 × activity matches):',
    ...report.recommendations.map(
      (r, i) =>
        `${i + 1}. ${formatDay(r.date)} ${r.time}${r.venueName ? ` at ${r.venueName}` : ''} — ${r.explanation}`,
    ),
  );
  return lines.join('\n');
}

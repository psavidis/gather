import { useEffect, useState, type FormEvent } from 'react';
import type { Report as ReportData } from '../../backend/src/report';
import { formatDay } from './format';
import { PublishForm } from './PublishForm';
import { ACTIVITY_LABELS, LOCATION_LABELS } from './labels';
import { counts, reportText, weekLabel } from './report-text';
import { href } from './router';
import { useSession } from './session';

/** The administrator's results report for a closed round (spec §6). */
export function Report({ roundId }: { roundId: string }) {
  const { call } = useSession();
  const [report, setReport] = useState<ReportData>();
  const [problem, setProblem] = useState<string>();
  const [windowStart, setWindowStart] = useState('19:00');
  const [windowEnd, setWindowEnd] = useState('22:00');
  const [copied, setCopied] = useState(false);

  const load = (window: Record<string, string> = {}) =>
    call<ReportData>('getReport', { roundId, ...window }).then(
      (data) => {
        setProblem(undefined);
        setReport(data);
      },
      (e: Error) => setProblem(e.message),
    );

  useEffect(() => {
    call<ReportData>('getReport', { roundId }).then(setReport, (e: Error) => setProblem(e.message));
  }, [call, roundId]);

  function showWindow(event: FormEvent) {
    event.preventDefault();
    void load({ windowStart, windowEnd });
  }

  async function copy() {
    await navigator.clipboard.writeText(reportText(report!));
    setCopied(true);
  }

  if (!report) return problem ? <p role="alert">{problem}</p> : <p>Loading…</p>;
  const { participation: p, preferences: prefs } = report;

  return (
    <section>
      <p>
        <a href={href('admin', 'rounds')}>← Rounds</a>
      </p>
      <h2>Results — week of {weekLabel(report.days)}</h2>

      <h3>Participation</h3>
      <p>
        {p.submitted} of {p.eligible} voted ({p.percentage}%).{' '}
        {p.missing > 0 && <>No response from {p.missingNames.join(', ')}.</>}
      </p>

      <h3>Availability</h3>
      <div className="table-scroll">
        <table aria-label="Availability per day">
          <thead>
            <tr>
              <th>Day</th>
              <th>At 18:30</th>
              <th>At 21:00</th>
              <th>No preference</th>
              <th>Unavailable</th>
              <th>No response</th>
            </tr>
          </thead>
          <tbody>
            {report.availability.map((d) => (
              <tr key={d.date}>
                <th scope="row">{formatDay(d.date)}</th>
                <td>{d.availableAt1830}</td>
                <td>{d.availableAt2100}</td>
                <td>{d.flexible}</td>
                <td>{d.unavailable}</td>
                <td>{d.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Anyone available at 18:30 is also counted at 21:00. No response is never counted as
        available.
      </p>

      <form className="inline-form" onSubmit={showWindow} aria-label="Custom time window">
        <label>
          From
          <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
        </label>
        <label>
          To
          <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
        </label>
        <button type="submit">Show window</button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      {report.window && (
        <div className="table-scroll">
          <table aria-label={`Availability ${report.window.start}–${report.window.end}`}>
            <thead>
              <tr>
                <th>Day</th>
                <th>From the start</th>
                <th>Joining later</th>
                <th>Too late</th>
                <th>No preference</th>
                <th>Unavailable</th>
                <th>No response</th>
              </tr>
            </thead>
            <tbody>
              {report.window.days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{formatDay(d.date)}</th>
                  <td>{d.fromStart}</td>
                  <td>{d.joiningLater.map((j) => `${j.count} at ${j.time}`).join(', ') || '0'}</td>
                  <td>{d.notInWindow}</td>
                  <td>{d.flexible}</td>
                  <td>{d.unavailable}</td>
                  <td>{d.missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Preferences</h3>
      <dl className="summary">
        <dt>Activity</dt>
        <dd>{counts(prefs.activity, ACTIVITY_LABELS) || 'None'}</dd>
        <dt>Location</dt>
        <dd>
          {counts(prefs.location, LOCATION_LABELS) || 'None'}
          {prefs.areas.length > 0 && ` (areas: ${prefs.areas.join(', ')})`}
        </dd>
        <dt>Venues</dt>
        <dd>
          {prefs.venues.map((v) => `${v.name} ${v.votes}`).join(', ') || 'No venue picks'}
          {` · no preference ${prefs.venuesFlexible} · skipped ${prefs.venuesSkipped}`}
        </dd>
      </dl>

      <h3>Recommendations</h3>
      <p className="muted">
        Score = 3 × available + 1 × flexible + 2 × venue picks + 1 × activity matches.
      </p>
      {report.recommendations.length === 0 && <p>Nobody is available on any day.</p>}
      <ol className="cards" aria-label="Recommendations">
        {report.recommendations.map((r) => (
          <li key={`${r.date}-${r.time}-${r.venueId}`}>
            <strong>
              {formatDay(r.date)} · {r.time}
              {r.venueName && ` · ${r.venueName}`}
            </strong>{' '}
            — score {r.score}
            <div className="muted">{r.explanation}</div>
            <div className="muted">
              {counts(r.activities, ACTIVITY_LABELS)} · {counts(r.locations, LOCATION_LABELS)}
            </div>
          </li>
        ))}
      </ol>

      {report.status === 'closed' && <PublishForm report={report} />}

      <h3>Share</h3>
      <div className="actions">
        <button onClick={() => void copy()}>Copy report as text</button>
        {copied && <span role="status">Copied — participants&apos; names are not included.</span>}
      </div>
      <details>
        <summary>Plain-text report</summary>
        <pre className="report-text">{reportText(report)}</pre>
      </details>
    </section>
  );
}

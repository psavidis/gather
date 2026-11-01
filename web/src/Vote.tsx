import { useEffect, useState } from 'react';
import {
  ACTIVITIES,
  AVAILABILITY,
  LOCATIONS,
  type Activity,
  type Availability,
  type LocationPreference,
  type Venue,
} from '../../backend/src/db';
import type { CurrentRound } from '../../backend/src/votes';
import { formatDay } from './format';
import { ACTIVITY_LABELS, AVAILABILITY_LABELS, LOCATION_LABELS } from './labels';
import { href } from './router';
import { useSession } from './session';
import { VenueMap } from './VenueMap';

interface Answers {
  availability: Record<string, Availability>;
  activity?: Activity;
  location?: LocationPreference;
  locationArea: string;
  venues: string[];
  venuesFlexible: boolean;
}

const STEPS = ['Availability', 'Activity', 'Location', 'Venues', 'Review'] as const;

/** The five-step voting wizard (spec §3.2). */
export function Vote() {
  const { call } = useSession();
  const [round, setRound] = useState<CurrentRound | null>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [answers, setAnswers] = useState<Answers>();
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([call<CurrentRound | null>('getCurrentRound'), call<Venue[]>('listVenues')]).then(
      ([current, catalog]) => {
        setRound(current);
        setVenues(catalog);
        setAnswers(
          current?.myVote ?? {
            availability: {},
            locationArea: '',
            venues: [],
            venuesFlexible: false,
          },
        );
      },
      (e: Error) => setProblem(e.message),
    );
  }, [call]);

  if (problem && !answers) return <p role="alert">{problem}</p>;
  if (round === undefined || !answers) return <p>Loading…</p>;
  if (!round || round.status !== 'open' || !round.participant) {
    return (
      <section>
        <p>Voting is not open for you right now.</p>
        <a href={href()}>Back to home</a>
      </section>
    );
  }
  if (saved) {
    return (
      <section role="status">
        <h2>Thanks — your vote is saved</h2>
        <p>You can change it until voting closes.</p>
        <a href={href()}>Back to home</a>
      </section>
    );
  }

  const set = (changes: Partial<Answers>) => setAnswers({ ...answers, ...changes });

  function next() {
    const missing =
      (step === 0 &&
        round!.days.some((d) => !answers!.availability[d]) &&
        'Answer every day of the week') ||
      (step === 1 && !answers!.activity && 'Choose an activity') ||
      (step === 2 && !answers!.location && 'Choose a location');
    setProblem(missing || undefined);
    if (!missing) setStep(step + 1);
  }

  async function submit() {
    setProblem(undefined);
    try {
      await call('submitVote', { roundId: round!.roundId, ...answers });
      setSaved(true);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }

  return (
    <section>
      <h2>{STEPS[step]}</h2>
      <p className="muted">
        Step {step + 1} of {STEPS.length}
      </p>

      {step === 0 && (
        <>
          <p>Choosing a time means you are available then — it is not a commitment to attend.</p>
          {round.days.map((day) => (
            <Choices
              key={day}
              legend={formatDay(day)}
              name={`day-${day}`}
              options={AVAILABILITY}
              labels={AVAILABILITY_LABELS}
              value={answers.availability[day]}
              onChange={(value) => set({ availability: { ...answers.availability, [day]: value } })}
            />
          ))}
        </>
      )}

      {step === 1 && (
        <Choices
          legend="What would you like to do?"
          name="activity"
          options={ACTIVITIES}
          labels={ACTIVITY_LABELS}
          value={answers.activity}
          onChange={(activity) => set({ activity })}
        />
      )}

      {step === 2 && (
        <>
          <Choices
            legend="Where would you prefer to go?"
            name="location"
            options={LOCATIONS}
            labels={LOCATION_LABELS}
            value={answers.location}
            onChange={(location) => set({ location })}
          />
          {(answers.location === 'home' || answers.location === 'other') && (
            <label>
              Area (optional)
              <input
                value={answers.locationArea}
                maxLength={80}
                placeholder="A neighbourhood or metro station"
                onChange={(e) => set({ locationArea: e.target.value })}
              />
              <span className="muted">Please don&apos;t enter your home address.</span>
            </label>
          )}
        </>
      )}

      {step === 3 && <VenueStep venues={venues} answers={answers} onChange={set} />}

      {step === 4 && <Review round={round} venues={venues} answers={answers} onEdit={setStep} />}

      {problem && <p role="alert">{problem}</p>}

      <div className="wizard-nav">
        {step > 0 ? (
          <button
            onClick={() => {
              setProblem(undefined);
              setStep(step - 1);
            }}
          >
            Back
          </button>
        ) : (
          <a href={href()}>Cancel</a>
        )}
        {step < 4 ? (
          <button className="primary" onClick={next}>
            Next
          </button>
        ) : (
          <button className="primary" onClick={() => void submit()}>
            {round.myVote ? 'Update vote' : 'Submit vote'}
          </button>
        )}
      </div>
    </section>
  );
}

function Choices<T extends string>(props: {
  legend: string;
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend>{props.legend}</legend>
      <div className="choices">
        {props.options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={props.name}
              checked={props.value === option}
              onChange={() => props.onChange(option)}
            />
            {props.labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function VenueStep({
  venues,
  answers,
  onChange,
}: {
  venues: Venue[];
  answers: Answers;
  onChange: (changes: Partial<Answers>) => void;
}) {
  const selected = new Set(answers.venues);
  const toggle = (venueId: string) =>
    onChange({
      venuesFlexible: false,
      venues: selected.has(venueId)
        ? answers.venues.filter((id) => id !== venueId)
        : [...answers.venues, venueId],
    });

  return (
    <>
      <p>
        Pick any venues you&apos;d like, or skip this step if you have no particular preference.
      </p>
      {venues.length > 0 && <VenueMap venues={venues} selected={selected} onToggle={toggle} />}
      <fieldset>
        <legend>Preferred venues</legend>
        <div className="choices">
          {venues.map((venue) => (
            <label key={venue.venueId}>
              <input
                type="checkbox"
                checked={selected.has(venue.venueId)}
                onChange={() => toggle(venue.venueId)}
              />
              {venue.name}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={answers.venuesFlexible}
              onChange={(e) => onChange({ venuesFlexible: e.target.checked, venues: [] })}
            />
            No preference — any venue is fine
          </label>
        </div>
      </fieldset>
    </>
  );
}

function Review({
  round,
  venues,
  answers,
  onEdit,
}: {
  round: CurrentRound;
  venues: Venue[];
  answers: Answers;
  onEdit: (step: number) => void;
}) {
  const venueNames = venues.filter((v) => answers.venues.includes(v.venueId)).map((v) => v.name);
  const area = answers.locationArea ? `: ${answers.locationArea}` : '';

  return (
    <>
      <dl className="summary" aria-label="Your choices">
        {round.days.map((day) => (
          <div key={day}>
            <dt>{formatDay(day)}</dt>
            <dd>{AVAILABILITY_LABELS[answers.availability[day]]}</dd>
          </div>
        ))}
        <dt>Activity</dt>
        <dd>{answers.activity && ACTIVITY_LABELS[answers.activity]}</dd>
        <dt>Location</dt>
        <dd>
          {answers.location && LOCATION_LABELS[answers.location]}
          {area}
        </dd>
        <dt>Venues</dt>
        <dd>
          {venueNames.length > 0
            ? venueNames.join(', ')
            : answers.venuesFlexible
              ? 'No preference — any venue is fine'
              : 'No particular preference'}
        </dd>
      </dl>
      <div className="actions">
        {['availability', 'activity', 'location', 'venues'].map((name, index) => (
          <button key={name} onClick={() => onEdit(index)}>
            Change {name}
          </button>
        ))}
      </div>
    </>
  );
}

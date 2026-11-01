import { useEffect, useState } from 'react';
import type { PublicEvent } from '../../backend/src/events';
import { callBackend } from './api';
import { downloadEventImage } from './event-image';
import { formatLongDay } from './format';
import { href } from './router';
import { useSessionState } from './session';
import { VenueMap } from './VenueMap';
import { directionsUrl } from './venues-display';

/** The public, shareable page of a published outing (spec §8). Needs no sign-in. */
export function EventPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEvent>();
  const [problem, setProblem] = useState<string>();
  const { session } = useSessionState();

  useEffect(() => {
    callBackend<PublicEvent>('getPublicEvent', { eventId }).then(setEvent, (e: Error) =>
      setProblem(e.message),
    );
  }, [eventId]);

  if (problem) return <p role="alert">{problem}</p>;
  if (!event) return <p>Loading…</p>;

  const { venue } = event;
  return (
    <article className="event" aria-label={event.title}>
      <p className="muted">{event.status === 'past' ? 'Past outing' : 'Upcoming outing'}</p>
      <h1>{event.title}</h1>
      <p className="event-when">
        {formatLongDay(event.date)} at {event.time}
      </p>
      <p className="event-where">
        <strong>{venue.name}</strong>
        {venue.address && (
          <>
            <br />
            {venue.address}
          </>
        )}
      </p>
      <div className="actions">
        {venue.googleMapsUrl && (
          <a href={venue.googleMapsUrl} target="_blank" rel="noopener noreferrer">
            Open in Google Maps
          </a>
        )}
        <a href={directionsUrl(venue)} target="_blank" rel="noopener noreferrer">
          Directions
        </a>
      </div>
      <VenueMap venues={[{ venueId: event.eventId, ...venue }]} />
      {event.alternative && (
        <p>
          <strong>Plan B:</strong> {event.alternative}
        </p>
      )}
      {event.notes && <p className="event-notes">{event.notes}</p>}
      {event.participantCount !== null && <p>{event.participantCount} people are expected.</p>}
      <div className="actions">
        <a href={href('events')}>All outings</a>
        {session?.user.role === 'admin' && (
          <button onClick={() => void downloadEventImage(event)}>Download image for Slack</button>
        )}
      </div>
    </article>
  );
}

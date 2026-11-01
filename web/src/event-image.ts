import type { PublicEvent } from '../../backend/src/events';
import { formatLongDay } from './format';

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Splits text into lines that fit `maxWidth`, keeping at most `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

/**
 * Draws a shareable 1200×630 image of the event's public details (spec §8).
 * Only fields of the public event are available here, so nothing private can appear.
 */
export function renderEventImage(event: PublicEvent): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#0b3d91');
  background.addColorStop(1, '#0b6bcb');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const textWidth = WIDTH - 2 * MARGIN;
  let y = MARGIN;
  const write = (text: string, size: number, weight: number, color: string, lines = 1) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    for (const line of wrap(ctx, text, textWidth, lines)) {
      y += size * 1.2;
      ctx.fillText(line, MARGIN, y);
    }
  };

  if (event.title.toLowerCase() !== 'team outing') {
    write('TEAM OUTING', 26, 600, '#9ec5ff');
    y += 12;
  }
  write(event.title, 64, 700, '#ffffff', 2);
  y += 20;
  write(`${formatLongDay(event.date)} · ${event.time}`, 40, 600, '#ffffff');
  y += 16;
  write(event.venue.name, 40, 600, '#ffffff');
  if (event.venue.address) write(event.venue.address, 28, 400, '#d6e6ff');
  if (event.notes) {
    y += 16;
    write(event.notes, 28, 400, '#ffffff', 2);
  }

  ctx.font = `400 24px ${FONT}`;
  ctx.fillStyle = '#9ec5ff';
  const footer = [
    event.participantCount !== null ? `${event.participantCount} people expected` : '',
    event.alternative ? `Plan B: ${event.alternative}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  if (footer) ctx.fillText(wrap(ctx, footer, textWidth, 1)[0], MARGIN, HEIGHT - MARGIN + 12);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))),
      'image/png',
    ),
  );
}

export async function downloadEventImage(event: PublicEvent) {
  const url = URL.createObjectURL(await renderEventImage(event));
  const link = document.createElement('a');
  link.href = url;
  link.download = `outing-${event.date}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

import { useEffect, useState } from 'react';

/** Hash-based routing: GitHub Pages cannot serve deep links to a single-page app. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export const href = (...segments: string[]) => `#/${segments.join('/')}`;

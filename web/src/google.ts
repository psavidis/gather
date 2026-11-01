/** Minimal typing for the parts of Google Identity Services that Gather uses. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, string>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let loading: Promise<GoogleIdentity> | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google ? resolve(window.google) : reject(new Error('Google sign-in unavailable'));
    script.onerror = () => reject(new Error('Google sign-in could not be loaded'));
    document.head.appendChild(script);
  });
  return loading;
}

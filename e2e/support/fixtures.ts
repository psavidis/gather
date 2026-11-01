import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { handleRequest } from '../../backend/src/api';
import { World } from '../../backend/test/support/world';

export { expect } from '@playwright/test';

/** Must match VITE_BACKEND_URL in playwright.config.ts. */
export const BACKEND_URL = 'https://backend.e2e.test/exec';

/** Replaces Google Identity Services: the button signs in with window.__googleCredential. */
const FAKE_GOOGLE_IDENTITY = `
  window.google = { accounts: { id: {
    initialize(options) { window.__gisCallback = options.callback; },
    renderButton(parent) {
      const button = document.createElement('button');
      button.textContent = 'Sign in with Google';
      button.onclick = () => window.__gisCallback({ credential: window.__googleCredential });
      parent.replaceChildren(button);
    },
  } } };
`;

const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export interface Network {
  backendDown: boolean;
}

interface Fixtures {
  /** The real backend logic with an in-memory spreadsheet, fake Google and a fixed clock. */
  world: World;
  network: Network;
  /** Opens the app in `page` and signs in as `email`. */
  signIn: (email: string, page?: Page) => Promise<void>;
  /** A separate browser (own session) for a second person. */
  newPage: () => Promise<Page>;
}

async function connect(context: BrowserContext, world: World, network: Network) {
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_GOOGLE_IDENTITY }),
  );
  await context.route('https://*.tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: EMPTY_PNG }),
  );
  await context.route(BACKEND_URL, (route) => {
    if (network.backendDown) return route.abort('connectionrefused');
    let body: unknown;
    try {
      body = handleRequest(route.request().postData() ?? '', world.deps);
    } catch (error) {
      console.error(error);
      body = { ok: false, error: 'internal', message: 'Something went wrong. Please try again.' };
    }
    return route.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    });
  });
}

export const test = base.extend<Fixtures>({
  world: async ({}, use) => use(new World()),
  network: async ({}, use) => use({ backendDown: false }),
  page: async ({ page, world, network }, use) => {
    await connect(page.context(), world, network);
    await use(page);
  },
  newPage: async ({ browser, world, network }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      await connect(context, world, network);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
  signIn: async ({ page, world }, use) => {
    await use(async (email, target = page) => {
      const credential = world.google.issue(email);
      await target.goto('/');
      await target.evaluate((token) => {
        (window as unknown as { __googleCredential: string }).__googleCredential = token;
      }, credential);
      await target.getByRole('button', { name: 'Sign in with Google' }).click();
    });
  },
});

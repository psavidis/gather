/**
 * Apps Script entry point and adapters. Everything Google-specific lives here;
 * the behaviour is in api.ts / auth.ts so it can be tested without Apps Script.
 *
 * Private configuration comes from Script Properties (never from the repository):
 *   SPREADSHEET_ID, GOOGLE_CLIENT_ID, INITIAL_ADMIN_EMAIL
 */
import { handleRequest, type BackendResponse } from './api';
import type { AllowlistEntry, UserStore } from './users';

const USERS_SHEET = 'Users';
const USERS_HEADER = ['email', 'googleSubject', 'displayName', 'role', 'enabled', 'createdAt'];
const EMAIL_COLUMN = 0;
const SUBJECT_COLUMN = 1;

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json(handleSafely(e.postData?.contents ?? ''));
}

function handleSafely(rawBody: string): BackendResponse {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10_000);
    const config = PropertiesService.getScriptProperties();
    return handleRequest(rawBody, {
      clientId: requiredProperty(config, 'GOOGLE_CLIENT_ID'),
      initialAdminEmail: config.getProperty('INITIAL_ADMIN_EMAIL') ?? '',
      now: () => new Date(),
      fetchTokenInfo,
      users: new SheetUserStore(requiredProperty(config, 'SPREADSHEET_ID')),
    });
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'internal' };
  } finally {
    lock.releaseLock();
  }
}

function json(body: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function requiredProperty(config: GoogleAppsScript.Properties.Properties, name: string): string {
  const value = config.getProperty(name);
  if (!value) throw new Error(`Script property ${name} is not set`);
  return value;
}

function fetchTokenInfo(idToken: string): { status: number; body: string } {
  const response = UrlFetchApp.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { muteHttpExceptions: true },
  );
  return { status: response.getResponseCode(), body: response.getContentText() };
}

/** Allowlist stored in the private spreadsheet's "Users" sheet, one row per user. */
class SheetUserStore implements UserStore {
  private readonly sheet: GoogleAppsScript.Spreadsheet.Sheet;
  private readonly rows: unknown[][];

  constructor(spreadsheetId: string) {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    this.sheet = spreadsheet.getSheetByName(USERS_SHEET) ?? createUsersSheet(spreadsheet);
    this.rows = this.sheet.getDataRange().getValues().slice(1);
  }

  findByEmail(email: string): AllowlistEntry | undefined {
    const row = this.rows[this.indexOf(email)];
    return row && toEntry(row);
  }

  add(entry: AllowlistEntry): void {
    const row = [
      entry.email,
      entry.googleSubject,
      entry.displayName,
      entry.role,
      entry.enabled,
      entry.createdAt,
    ];
    this.sheet.appendRow(row);
    this.rows.push(row);
  }

  recordGoogleSubject(email: string, subject: string): void {
    const index = this.indexOf(email);
    if (index < 0) return;
    this.sheet.getRange(index + 2, SUBJECT_COLUMN + 1).setValue(subject);
    this.rows[index][SUBJECT_COLUMN] = subject;
  }

  private indexOf(email: string): number {
    const wanted = email.trim().toLowerCase();
    return this.rows.findIndex((row) => String(row[EMAIL_COLUMN]).trim().toLowerCase() === wanted);
  }
}

function createUsersSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = spreadsheet.insertSheet(USERS_SHEET);
  sheet.appendRow(USERS_HEADER);
  sheet.setFrozenRows(1);
  return sheet;
}

function toEntry(row: unknown[]): AllowlistEntry {
  const [email, googleSubject, displayName, role, enabled, createdAt] = row;
  return {
    email: String(email).trim().toLowerCase(),
    googleSubject: String(googleSubject ?? ''),
    displayName: String(displayName ?? ''),
    role: role === 'admin' ? 'admin' : 'member',
    enabled: enabled === true || String(enabled).toUpperCase() === 'TRUE',
    createdAt: createdAt instanceof Date ? createdAt : new Date(String(createdAt)),
  };
}

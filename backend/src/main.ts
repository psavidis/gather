/**
 * Apps Script entry point and adapters. Everything Google-specific lives here;
 * behaviour lives in api.ts and the action modules so it can be tested without
 * Apps Script.
 *
 * Private configuration comes from Script Properties (never from the repository):
 *   SPREADSHEET_ID, GOOGLE_CLIENT_ID, INITIAL_ADMIN_EMAIL
 */
import { handleRequest, type BackendResponse } from './api';
import { SCHEMA } from './db';
import type { Row, Spreadsheet } from './spreadsheet';

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
      newId: () => Utilities.getUuid(),
      fetchTokenInfo,
      spreadsheet: new GoogleSpreadsheet(requiredProperty(config, 'SPREADSHEET_ID')),
    });
  } catch (error) {
    console.error(error);
    return { ok: false, error: 'internal', message: 'Something went wrong. Please try again.' };
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

/**
 * The private spreadsheet: one sheet per table, a header row, every cell stored
 * as plain text. Rows are read once per request and kept in sync on writes.
 */
class GoogleSpreadsheet implements Spreadsheet {
  private readonly file: GoogleAppsScript.Spreadsheet.Spreadsheet;
  private readonly cache = new Map<string, Row[]>();

  constructor(spreadsheetId: string) {
    this.file = SpreadsheetApp.openById(spreadsheetId);
  }

  rows(table: string): Row[] {
    let rows = this.cache.get(table);
    if (!rows) {
      const values = this.sheet(table).getDataRange().getDisplayValues().slice(1);
      rows = values.map((row) => row.map(String));
      this.cache.set(table, rows);
    }
    return rows.map((row) => [...row]);
  }

  append(table: string, row: Row): void {
    const rows = this.rows(table);
    this.sheet(table).appendRow(row);
    this.cache.set(table, [...rows, row]);
  }

  update(table: string, index: number, row: Row): void {
    const rows = this.rows(table);
    this.sheet(table)
      .getRange(index + 2, 1, 1, row.length)
      .setValues([row]);
    rows[index] = row;
    this.cache.set(table, rows);
  }

  remove(table: string, index: number): void {
    const rows = this.rows(table);
    this.sheet(table).deleteRow(index + 2);
    rows.splice(index, 1);
    this.cache.set(table, rows);
  }

  private sheet(table: string): GoogleAppsScript.Spreadsheet.Sheet {
    const existing = this.file.getSheetByName(table);
    if (existing) return existing;

    const columns = SCHEMA[table as keyof typeof SCHEMA].columns;
    const sheet = this.file.insertSheet(table);
    sheet.getRange(1, 1, sheet.getMaxRows(), columns.length).setNumberFormat('@');
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
}

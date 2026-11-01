import type { Row, Spreadsheet } from '../../src/spreadsheet';

/** Stands in for the private Google Sheet. */
export class InMemorySpreadsheet implements Spreadsheet {
  private readonly tables = new Map<string, Row[]>();

  rows(table: string): Row[] {
    return (this.tables.get(table) ?? []).map((row) => [...row]);
  }
  append(table: string, row: Row): void {
    this.tables.set(table, [...(this.tables.get(table) ?? []), [...row]]);
  }
  update(table: string, index: number, row: Row): void {
    this.tables.get(table)![index] = [...row];
  }
  remove(table: string, index: number): void {
    this.tables.get(table)!.splice(index, 1);
  }
}

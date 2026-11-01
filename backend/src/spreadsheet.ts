/**
 * Storage port: the private spreadsheet seen as named tables of text rows
 * (header excluded). Every cell is a string so Sheets never reinterprets values.
 */
export type Row = string[];

export interface Spreadsheet {
  rows(table: string): Row[];
  append(table: string, row: Row): void;
  update(table: string, index: number, row: Row): void;
  remove(table: string, index: number): void;
}

export interface Codec<T> {
  columns: string[];
  toRow(item: T): Row;
  fromRow(row: Row): T;
}

/** Typed access to one table. */
export class Table<T> {
  constructor(
    private readonly sheet: Spreadsheet,
    private readonly name: string,
    private readonly codec: Codec<T>,
  ) {}

  all(): T[] {
    return this.sheet.rows(this.name).map((row) => this.codec.fromRow(row));
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.all().find(predicate);
  }

  insert(item: T): void {
    this.sheet.append(this.name, this.codec.toRow(item));
  }

  replace(predicate: (item: T) => boolean, item: T): void {
    this.sheet.update(this.name, this.indexOf(predicate), this.codec.toRow(item));
  }

  remove(predicate: (item: T) => boolean): void {
    this.sheet.remove(this.name, this.indexOf(predicate));
  }

  private indexOf(predicate: (item: T) => boolean): number {
    const index = this.all().findIndex(predicate);
    if (index < 0) throw new Error(`No matching row in ${this.name}`);
    return index;
  }
}

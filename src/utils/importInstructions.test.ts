import { describe, expect, it } from 'vitest';

import { CLIENT_IMPORT_COLUMNS } from '@/features/settings/utils/clientImport';
import { JOBS_IMPORT, RATES_IMPORT, STAFF_IMPORT } from '@/features/settings/utils/bulkImport';
import { OPENING_BALANCE_COLUMNS } from '@/features/settings/utils/openingBalanceImport';

import {
  CLIENTS_SHEET,
  instructionRows,
  JOBS_SHEET,
  OPENING_BALANCES_SHEET,
  RATES_SHEET,
  STAFF_SHEET,
  type ImportSheet,
} from './importInstructions';

const names = (sheet: ImportSheet) => sheet.columns.map((column) => column.name);

describe('the import instructions', () => {
  it('describe exactly the columns of each template, in the same order', () => {
    expect(names(CLIENTS_SHEET)).toEqual([...CLIENT_IMPORT_COLUMNS]);
    expect(names(OPENING_BALANCES_SHEET)).toEqual([...OPENING_BALANCE_COLUMNS]);
    expect(names(STAFF_SHEET)).toEqual(STAFF_IMPORT.columns.map(([name]) => name));
    expect(names(RATES_SHEET)).toEqual(RATES_IMPORT.columns.map(([name]) => name));
    expect(names(JOBS_SHEET)).toEqual(JOBS_IMPORT.columns.map(([name]) => name));
  });

  it('mark as required the columns the importer insists on', () => {
    const required = (sheet: ImportSheet) =>
      sheet.columns.filter((column) => column.required).map((column) => column.name);
    expect(required(STAFF_SHEET)).toEqual([...STAFF_IMPORT.required]);
    expect(required(RATES_SHEET)).toEqual([...RATES_IMPORT.required]);
    expect(required(JOBS_SHEET)).toEqual([...JOBS_IMPORT.required]);
    expect(required(OPENING_BALANCES_SHEET)).toEqual(['client', 'staff', 'date', 'hours']);
    expect(required(CLIENTS_SHEET)).toEqual(['name']);
  });

  it('explain every column: what to enter, what is allowed and an example', () => {
    for (const sheet of [
      CLIENTS_SHEET,
      OPENING_BALANCES_SHEET,
      STAFF_SHEET,
      RATES_SHEET,
      JOBS_SHEET,
    ]) {
      for (const column of sheet.columns) {
        expect(column.what.length, `${sheet.slug}.${column.name} what`).toBeGreaterThan(5);
        expect(column.allowed.length, `${sheet.slug}.${column.name} allowed`).toBeGreaterThan(2);
        expect(column.example, `${sheet.slug}.${column.name} example`).not.toBe('');
      }
    }
  });

  it('turn into spreadsheet rows: the steps, then one row per column', () => {
    const rows = instructionRows(RATES_SHEET);
    expect(rows[0]?.[0]).toBe('Rates: how to fill in the import file');
    const header = rows.findIndex((row) => row[0] === 'Column');
    expect(rows.slice(header + 1, header + 1 + RATES_SHEET.columns.length)).toHaveLength(
      RATES_SHEET.columns.length,
    );
    expect(rows[header + 1]).toEqual([
      'kind',
      'Yes',
      'Whether it is what the person costs or what you charge.',
      'cost or charge',
      'charge',
    ]);
    expect(rows.flat().some((cell) => cell.startsWith('1. Open the template'))).toBe(true);
  });
});

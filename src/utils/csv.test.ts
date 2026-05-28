/**
 * Unit tests for the CSV helper.
 *
 * Run with `bun test src/utils/csv.test.ts`.
 */

import { describe, expect, test } from 'bun:test';

import { toCsv } from './csv';

describe('toCsv', () => {
  test('emits a header-only file when no rows are provided', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });

  test('joins cells with commas and rows with CRLF', () => {
    const csv = toCsv(['a', 'b'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('a,b\r\n1,2\r\n3,4');
  });

  test('quotes values containing commas', () => {
    const csv = toCsv(['x'], [['hello, world']]);
    expect(csv).toBe('x\r\n"hello, world"');
  });

  test('quotes values containing newlines', () => {
    const csv = toCsv(['x'], [['line1\nline2']]);
    expect(csv).toBe('x\r\n"line1\nline2"');
  });

  test('escapes embedded double-quotes by doubling them', () => {
    const csv = toCsv(['x'], [['she said "hi"']]);
    expect(csv).toBe('x\r\n"she said ""hi"""');
  });

  test('treats null and undefined as empty strings', () => {
    const csv = toCsv(['a', 'b', 'c'], [[null, undefined, '']]);
    expect(csv).toBe('a,b,c\r\n,,');
  });

  test('stringifies numbers and booleans without quoting', () => {
    const csv = toCsv(['n', 'b'], [[42, true]]);
    expect(csv).toBe('n,b\r\n42,true');
  });

  test('does not quote benign content even when other cells need it', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has, comma']]);
    expect(csv).toBe('a,b\r\nplain,"has, comma"');
  });
});

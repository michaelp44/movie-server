import { describe, expect, it } from 'vitest';
import {
  buildSheetBatchRequests,
  rowsFromSheetValues,
  type SheetChange,
  type SheetUpdatePlan,
  validateSheetUpdatePlan,
  verifyAppliedChanges,
} from './sheets-update-service.js';

const values = [
  ['נקנה?', 'קטגוריה', 'מוצר', 'כמות', 'יחידה', 'הערות', 'מי מביא'],
  [false, '🥩 בשר', 'אנטריקוט', 2, 'ק״ג', '', ''],
  [false, '🥩 בשר', 'קבב', 12, 'יחידות', '', 'מישהו אחר'],
  [true, '🥤 שתייה', 'מים', 3, 'שישיות', 'קרים', ''],
];

describe('Google Sheets shopping-list safety', () => {
  it('parses only the expected seven-column shopping-list structure', () => {
    expect(rowsFromSheetValues(values)).toEqual([
      {
        rowNumber: 2,
        purchased: false,
        category: '🥩 בשר',
        product: 'אנטריקוט',
        quantity: '2',
        unit: 'ק״ג',
        notes: '',
        broughtBy: '',
      },
      {
        rowNumber: 3,
        purchased: false,
        category: '🥩 בשר',
        product: 'קבב',
        quantity: '12',
        unit: 'יחידות',
        notes: '',
        broughtBy: 'מישהו אחר',
      },
      {
        rowNumber: 4,
        purchased: true,
        category: '🥤 שתייה',
        product: 'מים',
        quantity: '3',
        unit: 'שישיות',
        notes: 'קרים',
        broughtBy: '',
      },
    ]);

    expect(() =>
      rowsFromSheetValues([['שם', 'קטגוריה', 'מוצר', 'כמות', 'יחידה', 'הערות', 'מי מביא']])
    ).toThrow('מבנה הגיליון השתנה');
  });

  it('rejects stale row references, duplicate additions, and unknown categories', () => {
    const rows = rowsFromSheetValues(values);
    const base = { outcome: 'apply', message: '', summary: 'בדיקה' } as const;

    expect(() =>
      validateSheetUpdatePlan(
        {
          ...base,
          changes: [
            { kind: 'update', rowNumber: 2, expectedProduct: 'מוצר אחר', fields: [{ column: 'quantity', value: '4' }] },
          ],
        },
        rows,
        20
      )
    ).toThrow('השתנתה מאז הקריאה');

    expect(() =>
      validateSheetUpdatePlan(
        {
          ...base,
          changes: [{ kind: 'add', category: '🥩 בשר', product: 'אנטריקוט', quantity: '3', unit: 'ק״ג', notes: '', broughtBy: '' }],
        },
        rows,
        20
      )
    ).toThrow('כבר קיים');

    expect(() =>
      validateSheetUpdatePlan(
        {
          ...base,
          changes: [{ kind: 'add', category: 'קטגוריה חדשה', product: 'קרח', quantity: '3', unit: 'שקיות', notes: '', broughtBy: '' }],
        },
        rows,
        20
      )
    ).toThrow('לא קיימת בגיליון');
  });

  it('builds bounded updates, descending deletes, and formatted validated row inserts', () => {
    const rows = rowsFromSheetValues(values);
    const changes: SheetChange[] = [
      {
        kind: 'update',
        rowNumber: 2,
        expectedProduct: 'אנטריקוט',
        fields: [{ column: 'quantity', value: '4' }],
      },
      { kind: 'delete', rowNumber: 4, expectedProduct: 'מים' },
      { kind: 'delete', rowNumber: 3, expectedProduct: 'קבב' },
      {
        kind: 'add',
        category: '🥩 בשר',
        product: 'פרגיות',
        quantity: '2',
        unit: 'ק״ג',
        notes: 'חתוך לקוביות',
        broughtBy: '',
      },
    ];
    const requests = buildSheetBatchRequests(123, rows, changes);

    expect(requests).toHaveLength(7);
    expect(requests[0]?.updateCells?.range).toMatchObject({
      sheetId: 123,
      startRowIndex: 1,
      endRowIndex: 2,
      startColumnIndex: 3,
      endColumnIndex: 4,
    });
    expect(requests[1]?.deleteDimension?.range?.startIndex).toBe(3);
    expect(requests[2]?.deleteDimension?.range?.startIndex).toBe(2);
    expect(requests[3]?.insertDimension).toBeDefined();
    expect(requests[4]?.copyPaste?.pasteType).toBe('PASTE_FORMAT');
    expect(requests[5]?.copyPaste?.pasteType).toBe('PASTE_DATA_VALIDATION');
    expect(requests[6]?.updateCells?.rows?.[0]?.values?.[2]?.userEnteredValue).toEqual({
      stringValue: 'פרגיות',
    });
  });

  it('verifies successful changes and detects incomplete writes', () => {
    const changes: SheetChange[] = [
      {
        kind: 'update',
        rowNumber: 2,
        expectedProduct: 'אנטריקוט',
        fields: [{ column: 'quantity', value: '4' }],
      },
      { kind: 'delete', rowNumber: 3, expectedProduct: 'קבב' },
      {
        kind: 'add',
        category: '🥤 שתייה',
        product: 'קרח',
        quantity: '3',
        unit: 'שקיות',
        notes: '',
        broughtBy: '',
      },
    ];
    const after = rowsFromSheetValues([
      values[0]!,
      [false, '🥩 בשר', 'אנטריקוט', 4, 'ק״ג', '', ''],
      [true, '🥤 שתייה', 'מים', 3, 'שישיות', 'קרים', ''],
      [false, '🥤 שתייה', 'קרח', 3, 'שקיות', '', ''],
    ]);

    expect(() => verifyAppliedChanges(after, changes)).not.toThrow();
    const incomplete = rowsFromSheetValues([
      values[0]!,
      [false, '🥩 בשר', 'אנטריקוט', 2, 'ק״ג', '', ''],
      [true, '🥤 שתייה', 'מים', 3, 'שישיות', 'קרים', ''],
    ]);
    expect(() => verifyAppliedChanges(incomplete, changes)).toThrow('האימות נכשל');
  });

  it('requires refusal and clarification plans to contain no mutations', () => {
    const invalidPlan: SheetUpdatePlan = {
      outcome: 'refuse',
      message: 'לא קשור לרשימה',
      summary: '',
      changes: [
        {
          kind: 'delete',
          rowNumber: 2,
          expectedProduct: 'אנטריקוט',
        },
      ],
    };
    expect(() => validateSheetUpdatePlan(invalidPlan, rowsFromSheetValues(values), 20)).toThrow(
      'cannot contain changes'
    );
  });

  it('updates only empty broughtBy cells and protects notes', () => {
    const before = rowsFromSheetValues(values);
    const change: SheetChange = {
      kind: 'bulk_update_field',
      column: 'broughtBy',
      match: 'empty',
      matchValue: '',
      operation: 'set',
      value: 'מיכאל ושובל',
      separator: '',
    };
    const plan: SheetUpdatePlan = { outcome: 'apply', message: '', summary: 'עדכון אחראים', changes: [change] };
    expect(() => validateSheetUpdatePlan(plan, before, 20, 'בכל מקום שלא כתוב מי מביא תכתוב מיכאל ושובל')).not.toThrow();
    const requests = buildSheetBatchRequests(123, before, [change]);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.updateCells?.range).toMatchObject({ startColumnIndex: 6, endColumnIndex: 7 });
    expect(requests[0]?.updateCells?.rows?.[0]?.values?.[0]?.userEnteredValue).toEqual({ stringValue: 'מיכאל ושובל' });

    const after = rowsFromSheetValues([
      values[0]!,
      [false, '🥩 בשר', 'אנטריקוט', 2, 'ק״ג', '', 'מיכאל ושובל'],
      [false, '🥩 בשר', 'קבב', 12, 'יחידות', '', 'מישהו אחר'],
      [true, '🥤 שתייה', 'מים', 3, 'שישיות', 'קרים', 'מיכאל ושובל'],
    ]);
    expect(() => verifyAppliedChanges(after, [change], before)).not.toThrow();
    expect(() => verifyAppliedChanges(before, [change], before)).toThrow('האימות נכשל');
    expect(() => validateSheetUpdatePlan({ ...plan, changes: [change, { kind: 'delete', rowNumber: 2, expectedProduct: 'אנטריקוט' }] }, before, 20)).toThrow('הפעולה היחידה');
    const wrongColumn: SheetUpdatePlan = { ...plan, changes: [{ ...change, column: 'notes' }] };
    expect(() => validateSheetUpdatePlan(wrongColumn, before, 20, 'בכל מקום שלא כתוב מי מביא תכתוב מיכאל ושובל')).toThrow('אסור לשנות');
  });
});

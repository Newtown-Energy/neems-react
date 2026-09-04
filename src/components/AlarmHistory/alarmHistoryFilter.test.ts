import { describe, expect, it } from 'bun:test';
import { effectiveAlarmNums } from './alarmHistoryFilter';

describe('effectiveAlarmNums', () => {
  it('asks for every alarm when nothing narrows the query', () => {
    expect(effectiveAlarmNums(undefined, [])).toBeUndefined();
  });

  it('passes the operator selection through on an unrestricted page', () => {
    expect(effectiveAlarmNums(undefined, [3, 401])).toEqual([3, 401]);
  });

  it('falls back to the page restriction when nothing is selected', () => {
    expect(effectiveAlarmNums([401, 402], [])).toEqual([401, 402]);
  });

  it('intersects the selection with the page restriction', () => {
    expect(effectiveAlarmNums([401, 402, 611], [402, 611])).toEqual([402, 611]);
  });

  // The restriction is the page's subject, not a default. A selection reaching
  // outside it must lose those alarms rather than widen the page.
  it('drops a selected alarm the page does not cover', () => {
    expect(effectiveAlarmNums([401, 402], [3, 402])).toEqual([402]);
  });

  // Empty means "no rows", never "all rows" — see the doc comment.
  it('returns an empty list, not undefined, for a disjoint selection', () => {
    expect(effectiveAlarmNums([401, 402], [3])).toEqual([]);
  });
});

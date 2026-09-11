/**
 * Resolve which alarm numbers a history query should ask for.
 *
 * Two independent narrowings meet here: the page's own subject (FDNY shows
 * fire alarms and nothing else) and whatever the operator picked in the filter
 * dropdown. The page restriction is not a default the operator can widen — it
 * is what the page *is* — so the result is always the intersection.
 *
 * Returns `undefined` to mean "every alarm", matching `fetchAlarmHistory`,
 * which omits the `alarm_nums` parameter for an absent or empty list. An empty
 * array is therefore NOT the same thing and must not be passed on: it means the
 * selection and the restriction are disjoint, so the honest answer is no rows.
 * Handing that to the API would ask for, and render, the entire history — the
 * exact opposite of what was selected.
 */
export function effectiveAlarmNums(
  restrictTo: readonly number[] | undefined,
  selected: readonly number[],
): number[] | undefined {
  if (selected.length === 0) {
    return restrictTo ? [...restrictTo] : undefined;
  }
  if (!restrictTo) return [...selected];
  const allowed = new Set(restrictTo);
  return selected.filter((n) => allowed.has(n));
}

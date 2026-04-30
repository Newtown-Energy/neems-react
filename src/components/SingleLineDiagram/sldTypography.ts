// Typography constants for SLD elements. Centralized so the font legibility
// pass (SLD feedback round) stays consistent across components and is easy
// to tune in one place.
export const SLD_FONT = {
  /** Primary component label (e.g. megapack name, breaker designation). */
  label: 14,
  /** Secondary / subtitle label (e.g. "Relay", "SEL-735"). */
  subtitle: 13,
  /** Analog slot readouts below components. */
  analog: 13,
  /** Emphasized headers on large components (e.g. SEL-451 box title). */
  header: 16,
  /** Alarm indicator count badge. */
  badge: 12,
  /** Switch label next to knife-switch body. */
  switchLabel: 14,
  /** Bus bar label. */
  bus: 14,
};

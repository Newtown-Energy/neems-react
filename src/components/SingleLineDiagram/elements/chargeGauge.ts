/**
 * Geometry for the Megapack charge gauge — the client spreadsheet's
 * "MP gas gauge".
 *
 * Split out from the element so the arithmetic is testable without a DOM.
 * The rules it encodes are the ones worth getting right: a reading of zero
 * must not look like no reading, and a reading out of range must not paint
 * outside the track.
 */

/** Gauge track, in the element's local coordinates. */
export interface GaugeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The filled portion of the track. */
export interface GaugeFill {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Border thickness between the track edge and the fill. */
const INSET = 1;

/**
 * Track geometry for a pack body `w` x `h`.
 *
 * Sits on the left of the body, clear of the right-hand fan column, with
 * margin so the body outline stays readable when an alarm thickens it.
 */
export function gaugeGeometry(w: number, h: number): GaugeGeometry {
  return { x: -w / 2 + 6, y: -h / 2 + 8, width: 9, height: h - 16 };
}

/**
 * The fill rect for `soc`, or `null` when there is nothing to draw.
 *
 * Returns `null` for a missing or non-numeric reading — the caller draws no
 * gauge at all in that case. An empty track is indistinguishable from an
 * empty pack, and those are opposite claims; no reading shows no gauge,
 * matching the `--` in the text below the symbol.
 *
 * A reading of exactly 0 is a real measurement and does return a rect, of
 * zero height: the track is drawn, and it reads as empty because it is.
 *
 * Values outside 0-100 are clamped rather than rejected. Charge cannot
 * meaningfully exceed full, and painting past the track would look like a
 * rendering fault rather than the data fault it is.
 */
export function gaugeFill(
  soc: number | null | undefined,
  geometry: GaugeGeometry,
): GaugeFill | null {
  if (soc == null || Number.isNaN(soc)) return null;

  const pct = Math.max(0, Math.min(100, soc));
  const usableH = geometry.height - INSET * 2;
  const height = (pct / 100) * usableH;

  return {
    x: geometry.x + INSET,
    // Fills from the bottom, the way a level does.
    y: geometry.y + geometry.height - INSET - height,
    width: geometry.width - INSET * 2,
    height,
  };
}

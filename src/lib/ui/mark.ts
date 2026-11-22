/**
 * The Cathedral mark: the Sun Door in soft silver. The sun as a full disc,
 * a pointed doorway opening into it from below, in the text colour fading
 * from full at the top to half at the foot (option "Soft Silver" in
 * scratch/cathedral-logos-v3/silver.py, chosen 21 Nov 2026).
 *
 * One path on a 100-unit grid: the disc (centre 50,50, radius 48) with the
 * door cut from its foot (legs at x 37 and 63, springline y 64, arcs of
 * radius 30). Brand.svelte places it inside an <svg> with MARK_VIEWBOX.
 */

// Cropped to the disc, so the mark sits close to the wordmark.
export const MARK_VIEWBOX = "2 2 96 96";

export const MARK_PATH = "M37 96.206L37 64A30 30 0 0 1 50 39.282A30 30 0 0 1 63 64L63 96.206A48 48 0 1 0 37 96.206Z";

/**
 * The mark's markup. `id` names its fade, and must differ for every copy on
 * a page: two copies sharing one would draw both in the first one's colour.
 */
export function markSvg(id: string): string {
  return (
    `<defs><linearGradient id="${id}" x1="50" y1="0" x2="50" y2="130" gradientUnits="userSpaceOnUse">` +
    `<stop stop-color="currentColor"/><stop offset="1" stop-color="currentColor" stop-opacity="0.5"/>` +
    `</linearGradient></defs><path fill="url(#${id})" d="${MARK_PATH}"/>`
  );
}

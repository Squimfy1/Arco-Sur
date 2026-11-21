/**
 * Discreet mode: hide every amount on screen (the eye button in the top bar).
 * A look, not data, so it lives in the frontend and the server never knows.
 * theme.css blurs .num.money while the root element carries data-discreet.
 */

export const discreet = $state({ on: false });

export function toggleDiscreet(): void {
  discreet.on = !discreet.on;
  document.documentElement.toggleAttribute("data-discreet", discreet.on);
}

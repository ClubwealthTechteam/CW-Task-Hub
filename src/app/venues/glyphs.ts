// The white glyph drawn inside a venue pin for its category, so the category shows whatever the pin
// colour means (status, type or Google). Drawn in the pin's 24×24 box, centred on the pin head (12, 9);
// cut-outs (windows, doors) use the pin colour. Bold shapes so they read at the 28px map pin.

const W = '#fff';

const GLYPHS: Record<string, (color: string) => string> = {
  // A bed: headboard post, mattress and legs, a pillow and a blanket.
  Hotel: () =>
    `<path d="M7.3 5.6v7.3M7.3 10.9h9.4v2" stroke="${W}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<rect x="8.4" y="8.1" width="2.5" height="1.9" rx=".7" fill="${W}"/>`
    + `<path d="M11.6 7.9h3.6a1.5 1.5 0 0 1 1.5 1.5v1h-5.1z" fill="${W}"/>`,
  // Two people side by side.
  Association: () =>
    `<circle cx="9.7" cy="6.6" r="1.7" fill="${W}"/><circle cx="14.3" cy="6.6" r="1.7" fill="${W}"/>`
    + `<path d="M6.6 12.4a3.1 3.1 0 0 1 6.2 0z" fill="${W}"/><path d="M11.2 12.4a3.1 3.1 0 0 1 6.2 0z" fill="${W}"/>`,
  // A house with a door.
  'Home Builder': (c) =>
    `<path d="M12 4.3 6.6 8.8h1.5v4.2h7.8V8.8h1.5z" fill="${W}" stroke="${W}" stroke-width=".6" stroke-linejoin="round"/>`
    + `<rect x="11" y="10.2" width="2" height="2.8" fill="${c}"/>`,
  // A building with columns: roof, three columns, base.
  'Convention Center': () =>
    `<path d="M6.8 7.6 12 4.6l5.2 3z" fill="${W}" stroke="${W}" stroke-width=".6" stroke-linejoin="round"/>`
    + `<rect x="7.7" y="8.4" width="1.7" height="3.4" fill="${W}"/><rect x="11.15" y="8.4" width="1.7" height="3.4" fill="${W}"/>`
    + `<rect x="14.6" y="8.4" width="1.7" height="3.4" fill="${W}"/><rect x="6.8" y="12.1" width="10.4" height="1.3" rx=".3" fill="${W}"/>`,
  // An apartment block with a grid of windows.
  'Apartment Association': (c) =>
    `<rect x="8.2" y="4.4" width="7.6" height="9" rx=".6" fill="${W}"/>`
    + [5.6, 8, 10.4].flatMap((y) => [9.5, 13.1].map((x) => `<rect x="${x}" y="${y}" width="1.4" height="1.3" fill="${c}"/>`)).join(''),
};

/** The inside of a pin: the category glyph, or (no category) Google's letter icon or the plain dot. */
export function pinMark(type: string | undefined, color: string, letter: boolean): string {
  const g = type ? GLYPHS[type] : undefined;
  if (g) return g(color);
  return letter
    ? `<text x="12" y="12.6" text-anchor="middle" font-size="8" font-weight="800" fill="${W}" font-family="system-ui,sans-serif">T</text>`
    : `<circle cx="12" cy="9" r="2.7" fill="${W}"/>`;
}

/** The pin outline in the same 24×24 box. */
export const PIN_PATH = 'M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 5.5 7.4 13.4 7.4 13.4s7.4-7.9 7.4-13.4A7.4 7.4 0 0 0 12 1.6Z';

/** A whole pin as SVG markup, for the list and the legend. */
export const pinSvg = (type: string | undefined, color: string, letter = false, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${PIN_PATH}" fill="${color}"/>${pinMark(type, color, letter)}</svg>`;

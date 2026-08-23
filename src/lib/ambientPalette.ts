import { Vibrant } from "node-vibrant/browser";

export type Rgb = [number, number, number];

// Preference order for which Vibrant swatches to pull: vivid/dark swatches
// first, light ones last, since a light blob would read as a wash of white
// against the rest of the dark UI rather than an accent.
const SWATCH_ORDER = ["Vibrant", "DarkVibrant", "Muted", "DarkMuted", "LightVibrant", "LightMuted"] as const;

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// Keeps a swatch inside a dark, moderately-saturated band so no cover art
// (a stark white sleeve, a neon-pink single) can push a blob to a jarring
// brightness or saturation extreme.
function clampToBrandRange(hsl: Rgb): Rgb {
  const [h, s, l] = hsl;
  const clampedS = Math.min(s, 0.55);
  const clampedL = Math.min(Math.max(l, 0.16), 0.42);
  return hslToRgb(h, clampedS, clampedL);
}

export function mixRgb(a: Rgb, b: Rgb, weightA: number): Rgb {
  return [
    Math.round(a[0] * weightA + b[0] * (1 - weightA)),
    Math.round(a[1] * weightA + b[1] * (1 - weightA)),
    Math.round(a[2] * weightA + b[2] * (1 - weightA)),
  ];
}

export function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

// Resolves to [] (never rejects) so a CORS-tainted canvas (an art host
// without Access-Control-Allow-Origin) or a broken image URL just falls
// back to the venue's brand-only palette instead of taking down the display.
export async function extractPalette(imageUrl: string): Promise<Rgb[]> {
  try {
    const palette = await Vibrant.from(imageUrl).getPalette();
    return SWATCH_ORDER.map((key) => palette[key])
      .filter((swatch): swatch is NonNullable<typeof swatch> => swatch !== null)
      .slice(0, 3)
      .map((swatch) => clampToBrandRange(swatch.hsl as Rgb));
  } catch {
    return [];
  }
}

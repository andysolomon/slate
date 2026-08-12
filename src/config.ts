/** Compile-time settings — the four behaviour switches the prototype exposed
 *  as props, plus the accent colour every accent-coloured UI state derives from. */
export interface SlateConfig {
  grid: 'dots' | 'lines' | 'none';
  snapToGrid: boolean;
  bindArrows: boolean;
  stickyTools: boolean;
  accentColor: string;
}

export const CONFIG: SlateConfig = {
  grid: 'dots',
  snapToGrid: false,
  bindArrows: true,
  stickyTools: false,
  accentColor: '#9747FF',
};

/** Darken a #rrggbb colour by dl in HSL lightness — used for hover shades of the accent. */
export function shade(hex: string, dl: number): string {
  let h = hex.trim();
  if (h[0] !== '#') return hex;
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (h.length !== 7) return hex;
  const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let hu = 0, sa = 0;
  if (d) {
    sa = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hu = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hu /= 6;
  }
  const nl = Math.max(0, Math.min(1, l - dl));
  const q = nl < 0.5 ? nl * (1 + sa) : nl + sa - nl * sa, p = 2 * nl - q;
  const ch = (t: number) => {
    t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return sa === 0
    ? '#' + [nl, nl, nl].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
    : '#' + ch(hu + 1 / 3) + ch(hu) + ch(hu - 1 / 3);
}

export const ACCENT = CONFIG.accentColor;
export const ACCENT_DARK = shade(ACCENT, 0.09);

/** rgba() of the accent at the given alpha — used for the marquee fill. */
export function accentAlpha(alpha: number): string {
  let h = ACCENT;
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

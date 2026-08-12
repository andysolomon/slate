/** Open Color families, five shades each, in the order Excalidraw lays them out. */
export interface PaletteFamily {
  key: string;
  label: string;
  hint: string;
  shades: string[];
}

export const PALETTE: PaletteFamily[] = [
  { key: 'transparent', label: 'Transparent', hint: 'q', shades: ['transparent'] },
  { key: 'white', label: 'White', hint: 'w', shades: ['#ffffff'] },
  { key: 'grey', label: 'Grey', hint: 'e', shades: ['#f1f3f5', '#dee2e6', '#adb5bd', '#495057', '#212529'] },
  { key: 'black', label: 'Black', hint: 'r', shades: ['#1e1e1e'] },
  { key: 'bronze', label: 'Bronze', hint: 't', shades: ['#f5e6dc', '#e3c8b5', '#cfa78e', '#b08968', '#8a6647'] },
  { key: 'cyan', label: 'Cyan', hint: 'a', shades: ['#99e9f2', '#3bc9db', '#15aabf', '#0c8599', '#0b7285'] },
  { key: 'blue', label: 'Blue', hint: 's', shades: ['#a5d8ff', '#4dabf7', '#228be6', '#1971c2', '#1864ab'] },
  { key: 'violet', label: 'Violet', hint: 'd', shades: ['#d0bfff', '#9775fa', '#7048e8', '#5f3dc4', '#4c2889'] },
  { key: 'grape', label: 'Grape', hint: 'f', shades: ['#eebefa', '#da77f2', '#be4bdb', '#9c36b5', '#862e9c'] },
  { key: 'pink', label: 'Pink', hint: 'g', shades: ['#fcc2d7', '#f783ac', '#e64980', '#c2255c', '#a61e4d'] },
  { key: 'green', label: 'Green', hint: 'z', shades: ['#b2f2bb', '#69db7c', '#40c057', '#2f9e44', '#2b8a3e'] },
  { key: 'teal', label: 'Teal', hint: 'x', shades: ['#96f2d7', '#38d9a9', '#12b886', '#099268', '#087f5b'] },
  { key: 'yellow', label: 'Yellow', hint: 'c', shades: ['#ffec99', '#ffd43b', '#fab005', '#f08c00', '#e67700'] },
  { key: 'orange', label: 'Orange', hint: 'v', shades: ['#ffd8a8', '#ffa94d', '#fd7e14', '#e8590c', '#d9480f'] },
  { key: 'red', label: 'Red', hint: 'b', shades: ['#ffc9c9', '#ff8787', '#fa5252', '#e03131', '#c92a2a'] },
];

export function familyOf(color: string | undefined): PaletteFamily | null {
  const c = String(color || '').toLowerCase();
  return PALETTE.find((f) => f.shades.indexOf(c) >= 0) || null;
}

/**
 * Board coordinate model:
 * - r: 0..7 (0 is rank 8, 7 is rank 1)
 * - c: 0..7 (0 is file 'a', 7 is file 'h')
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

// PUBLIC_INTERFACE
export function coordToSquare({ r, c }) {
  const file = FILES[c];
  const rank = 8 - r;
  return `${file}${rank}`;
}

// PUBLIC_INTERFACE
export function squareToCoord(square) {
  const s = String(square || "").trim().toLowerCase();
  if (!/^[a-h][1-8]$/.test(s)) return null;
  const c = FILES.indexOf(s[0]);
  const r = 8 - Number(s[1]);
  return { r, c };
}

// PUBLIC_INTERFACE
export function isSameCoord(a, b) {
  return Boolean(a && b && a.r === b.r && a.c === b.c);
}

// PUBLIC_INTERFACE
export function inBounds({ r, c }) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

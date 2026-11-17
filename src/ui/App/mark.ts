/**
 * The portal's mark: three four-point sparkles (one large, two small, none
 * touching) cut out of a rounded tile, inside a 512 by 512 square. The tile
 * carries a gentle diagonal gradient. The header draws it in the current
 * test's colour; `public/icon.svg` and the installed-app icons use the SAT's.
 */
export const TILE_PATH =
  "M112 0H400A112 112 0 0 1 512 112V400A112 112 0 0 1 400 512H112A112 112 0 0 1 0 400V112A112 112 0 0 1 112 0Z";

export const MARK_PATH =
  "M292 108Q328.3 229.7 450 266Q328.3 302.3 292 424Q255.7 302.3 134 266Q255.7 229.7 292 108Z" +
  "M130 80Q144.7 129.3 194 144Q144.7 158.7 130 208Q115.3 158.7 66 144Q115.3 129.3 130 80Z" +
  "M146 328Q158 368 198 380Q158 392 146 432Q134 392 94 380Q134 368 146 328Z";

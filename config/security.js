'use strict';
// Polisi keselamatan kandungan. Mesti sama dengan <meta http-equiv="Content-Security-Policy"> dalam index.html.
// script-src tanpa 'unsafe-inline': semua JS dalam fail luaran. style-src masih perlukan 'unsafe-inline' kerana atribut style="" dalam templat UI.
const CARTO = 'https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com';
// Tile peta asas pilihan (OSM, OpenTopoMap, Esri). MapLibre mengambil tile raster dengan fetch, jadi perlu juga dalam connect-src.
const TILE =
  'https://tile.openstreetmap.org https://a.tile.opentopomap.org https://b.tile.opentopomap.org https://c.tile.opentopomap.org https://server.arcgisonline.com';
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CARTO} ${TILE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${CARTO} ${TILE}`,
  'frame-src https://embed.windy.com',
  'worker-src blob:',
  'child-src blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

module.exports = { CSP };

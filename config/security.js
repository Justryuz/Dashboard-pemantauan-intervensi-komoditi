'use strict';
// Polisi keselamatan kandungan. Mesti sama dengan <meta http-equiv="Content-Security-Policy"> dalam index.html.
// script-src tanpa 'unsafe-inline': semua JS dalam fail luaran. style-src masih perlukan 'unsafe-inline' kerana atribut style="" dalam templat UI.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com",
  'worker-src blob:',
  'child-src blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

module.exports = { CSP };

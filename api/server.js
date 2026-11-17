'use strict';
// Pelayan statik + API kecil tanpa dependensi. Jalankan: node api/server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  /* .env tiada: guna nilai lalai */
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Hanya laluan ini boleh dilayan. .env, .git, data/, docs/, api/ tidak pernah didedahkan.
const PUBLIC_FILES = new Set(['/', '/index.html', '/config/app.config.js']);
const PUBLIC_DIRS = ['/src/'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const { CSP } = require('../config/security.js');
const cuaca = require('./services/cuaca.js');
const banjir = require('./services/banjir.js');
const kualitiUdara = require('./services/kualiti-udara.js');
const muse = require('./services/muse.js');
const amaranDG = require('./services/amaran-datagov.js');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP + "; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function resolvePublic(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (p.includes('\0')) return null;
  const allowed = PUBLIC_FILES.has(p) || PUBLIC_DIRS.some((d) => p.startsWith(d));
  if (!allowed) return null;
  const rel = p === '/' ? 'index.html' : p.slice(1);
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null; // cegah path traversal
  return full;
}

const server = http.createServer((req, res) => {
  applyCors(req, res);
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS')
    return send(
      res,
      204,
      '',
      Object.fromEntries(
        [
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Methods',
          'Access-Control-Allow-Headers',
          'Access-Control-Max-Age',
          'Vary',
        ]
          .map((h) => [h, res.getHeader(h)])
          .filter(([, v]) => v !== undefined),
      ),
    );
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD, OPTIONS' });

  if (pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ status: 'ok' }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }

  if (pathname === '/api/muse') {
    const JSON_HDR = { 'Content-Type': 'application/json; charset=utf-8' };
    const minggu = new URL(req.url, 'http://localhost').searchParams.get('minggu');
    if (minggu !== null && !muse.tarikhSah(minggu))
      return send(
        res,
        400,
        JSON.stringify({ ralat: 'Parameter minggu tidak sah; guna format YYYY-MM-DD' }),
        JSON_HDR,
      );
    const cache = muse.bacaCache();
    if (!cache)
      return send(
        res,
        503,
        JSON.stringify({
          ralat: 'Data AI Muse belum tersedia',
          sedangDikemaskini: muse.sedangAmbil(),
        }),
        JSON_HDR,
      );
    return send(
      res,
      200,
      req.method === 'HEAD' ? '' : JSON.stringify(muse.kumpulMinggu(cache, minggu)),
      JSON_HDR,
    );
  }

  if (pathname === '/api/met-malaysia') {
    const JSON_HDR = { 'Content-Type': 'application/json; charset=utf-8' };
    const cache = amaranDG.bacaCache();
    // Lapisan ini pilihan: tanpa cache, pulangkan 200 kosong (bukan 503) supaya pelayar tidak mencatat ralat.
    if (!cache)
      return send(
        res,
        200,
        JSON.stringify({
          versi: 1,
          fetchedAt: null,
          atribusi: amaranDG.ATRIBUSI,
          sumber: { status: 'belum_tersedia', mesej: '' },
          sedangDikemaskini: amaranDG.sedangAmbil(),
          amaran: [],
        }),
        JSON_HDR,
      );
    const umur = amaranDG.umurJam(cache);
    const met = (cuaca.bacaCache() || {}).amaran || [];
    return send(
      res,
      200,
      req.method === 'HEAD'
        ? ''
        : JSON.stringify({
            ...cache,
            amaran: amaranDG.tandaiPendua(cache.amaran, met),
            umurJam: Number.isFinite(umur) ? umur : null,
          }),
      JSON_HDR,
    );
  }

  const API_CACHE = {
    '/api/cuaca': [cuaca, 'cuaca'],
    '/api/banjir': [banjir, 'banjir'],
    '/api/kualiti-udara': [kualitiUdara, 'kualiti udara'],
  };
  if (Object.hasOwn(API_CACHE, pathname)) {
    const [servis, label] = API_CACHE[pathname];
    const cache = servis.bacaCache();
    if (!cache)
      return send(
        res,
        503,
        JSON.stringify({
          ralat: `Data ${label} belum tersedia`,
          sedangDikemaskini: servis.sedangAmbil(),
        }),
        {
          'Content-Type': 'application/json; charset=utf-8',
        },
      );
    const umur = servis.umurJam(cache);
    return send(
      res,
      200,
      req.method === 'HEAD'
        ? ''
        : JSON.stringify({ ...cache, umurJam: Number.isFinite(umur) ? umur : null }),
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
  }

  const file = resolvePublic(pathname);
  if (!file) return send(res, 404, 'Not Found');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not Found');
    send(res, 200, req.method === 'HEAD' ? '' : buf, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    });
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Dashboard: http://${HOST}:${PORT}`);
    cuaca.mulaPenjadual();
    banjir.mulaPenjadual();
    kualitiUdara.mulaPenjadual();
    muse.mulaPenjadual();
    amaranDG.mulaPenjadual();
  });
}
module.exports = server;

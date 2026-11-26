'use strict';
// Build Command Vercel (vercel.json). Gagalkan build jika cache data wajib tiada dalam api/_data.
// Cache hanya dibina oleh GitHub Actions (.github/workflows/vercel-deploy.yml). Deploy dari komputer
// (`vercel deploy --prod`) tanpa cache akan gagal di sini, jadi ia tidak menggantikan produksi yang baik.
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'api', '_data');
const WAJIB = ['harga-ringkas.json', 'harga-meta.json', 'cuaca-terkini.json'];

const tiada = WAJIB.filter((f) => {
  try {
    return fs.statSync(path.join(DIR, f)).size === 0;
  } catch {
    return true;
  }
});

if (tiada.length) {
  console.error('Cache data wajib tiada dalam api/_data: ' + tiada.join(', '));
  console.error('Deploy dibatalkan supaya produksi kekal pada versi terakhir yang baik.');
  console.error(
    'Deploy melalui GitHub Actions: tab Actions > "Deploy Vercel (data + dashboard)" > Run workflow.',
  );
  process.exit(1);
}
console.log('Cache data wajib ada: ' + WAJIB.join(', '));

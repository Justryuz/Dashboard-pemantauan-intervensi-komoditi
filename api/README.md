# API

Folder ini hanya untuk pintu masuk Vercel.

- `index.js`: satu-satunya fungsi Vercel. Semua `/api/*` dihala ke sini (`vercel.json`).
- `_data/`: cache JSON yang dibina oleh GitHub Actions semasa deploy (tidak di-commit).

**Jangan letak fail `.js` lain di sini.** Vercel menjadikan setiap fail `.js` dalam `api/` satu fungsi
serverless, dan pelan Hobby hanya membenarkan 12 setiap deployment. Fail atau folder yang bermula dengan
`_` dikecualikan.

Kod pelayan sebenar ada di `lib/`:

- `lib/server.js`: pelayan HTTP (laluan `/api/*`, fail statik, header keselamatan). `npm start` menjalankan fail ini.
- `lib/services/`: pengambil data, normalisasi dan cache (cuaca, banjir, kualiti udara, AI Muse, harga, PSI, dll.).

Semua nilai sensitif dibaca dari `.env` (lihat `.env.example`).

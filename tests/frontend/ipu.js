'use strict';
// Kad IPU telah digantikan dengan kad 'Stesen Banjir JPS' (IV_SHOW_IPU=false dalam app.js).
// Fail ini kekal supaya `npm test` menjalankan ujian kad baharu (tests/frontend/stesen-banjir.js).
// Ujian API IPU kekal di tests/api/ipu-api.js.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const r = spawnSync(process.execPath, ['--no-warnings', path.join(__dirname, 'stesen-banjir.js')], {
  stdio: 'inherit',
});
process.exit(r.status === null ? 1 : r.status);

# AMS panel verification

Iteration: first implementation (no ams-review.json existed).

Commands (run from workspace root):
- `node .agents/tasks/ams-static.js` -> syntax ok; duplicate ids only `modalBack`/`modalClose` (already in the original modal templates, never mounted together); DATA line byte-identical; only 4 original lines changed (ring class, renderAll, openActionModal, DASHBOARD_TEST); no hardcoded 3/6/2 literals.
- `node .agents/tasks/ams-test.js` (headless Edge via puppeteer-core in `.agents/tasks/bt`) -> `RESULT pass=99 fail=0`. Full log: `ams-test-output.txt`.

Covered: default 3 cards, KPIs 3/6/2, no detail; S01 pills 2/1/2 and exact insight; S02 1/1/1; S03 2/2; colours (orange/red); single selection; click-to-collapse; "Kembali ke Senarai Senario"; PO drawer (logistics, shared "Angka gabungan", price block, separation note, Escape/Tutup); "Lihat harga komoditi PO ini"; rings on the correct markers with status classes unchanged; "Lihat Pilihan Intervensi" prefill, fallback toast, localStorage untouched; keyboard Enter/Space and focus ring; temporary 4th scenario then restored; loading/error/empty states; existing filters, marker click, hover popup, reset; panel sizes equal to the original at 1440 px; no console or page errors; no horizontal scroll at 1440/1024/390.

Screenshots (viewed): ams-1440.png, ams-1024.png, ams-390.png (plus *-default, *-s03, *-s03-full).

Not verified: real MET/JPS/AI APIs (none exist); the user's two reference screenshots were not available, so layout follows the written spec.

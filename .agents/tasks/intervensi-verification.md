# Verification: Dashboard Intervensi Komoditi (tab baharu)

Target: `Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html` (799,833 bytes; backup `backup-before-intervensi.html` 671,929 bytes).

## Resume state
This run resumed after the crash caused by an oversized screenshot. Inspection showed all 11 plan items were already implemented in the target file (`#ivStyle`, tab bar, `#viewMonitor` wrapper, `#viewIntervensi` with six panels, `#ivScript` IIFE exposing `IV_TEST`). The existing test suite passed in full, so no app code was changed in this run.

Changes made in this run:
- `intervensi-test.js`: replaced both `fullPage:true` screenshots with `panelShots()`, which takes per-panel clipped element screenshots (max 1600x1600). The `-lama` shots stay viewport-only.
- Deleted the old full-page PNGs (`intervensi-1440.png`, `intervensi-1024.png`, `intervensi-390.png`, `intervensi-1440-intervensi-default.png`).
- No commit: the workspace is not a git repository (`git status` returns "not a git repository").

## Command run
```
cd .agents/tasks/bt; node ../intervensi-test.js
```
Headless Edge via puppeteer-core with SwiftShader. Exit code 0. Full output is in `intervensi-test-output.txt`.

## Results: `JUMLAH GAGAL: 0`
Every check passes. Grouped by area:
- **Lint:** `node --check` passes on the extracted `ivScript`.
- **Isolation (1, 3c):** the baseline loads with 15 markers. Only the allowed `window` keys are added. No forbidden old hooks appear inside `#viewIntervensi`. `ivState` is unchanged by actions on the old tab.
- **Tabs (2, 3, 3b):** the old tab is visible by default with 15 `#map .po-marker`. The new tab opens with the title "Dashboard Intervensi Komoditi" and subtitle "Pemantauan Harga, Bekalan dan Cadangan Intervensi Pasaran". Switching back leaves the old map working. The `#intervensi` deep link works.
- **Mode and rules (4, 6b, unit):** PENGELUAR/PENGGUNA change marker colours and the priority list. Rows are sorted by score. T4 Kangar is not red, T5 Serian is "lapuk" and T7 price-only is "Waspada". The suffix "lebihan bekalan dikesan (data dummy)" appears on T1 and is absent on T4. Margin fixture and week counts pass.
- **Paparan 1 and 2 (5, 5b, 5c):** clicking each of the 15 PO markers zooms in and shows districts, outlets and panel updates. Outlet chips filter. The legend shows the 4 categories. The outlet popup is complete. Jasin shows "tiada outlet". A PO without a district mapping and a PO outside the filter are handled. Logistics figures match: KK 6/16.31/6/59.90 "tidak dapat dinilai", Johor/Simpang Renggam 5/62.0/92.4 "Terhad", Kota Baharu "Kritikal", Ayer Keroh "Sedia".
- **Filters (3, 11, thr):** Komoditi, Negeri (cascades to PO), PO, Daerah, Tempoh and Risiko all change the state. Set Semula restores the defaults. Thresholds can be configured and reset.
- **Paparan 3 Tindakan (6):** selects the PO, shows the banner and stays on the tab.
- **Paparan 4 (7, 7b, 7c):**
  - T1 and T2 lists are correct, and Sabah/Sarawak are excluded for a Peninsular anchor.
  - Weights sum to 100.
  - Pahang is filtered out at `refNow` and becomes eligible with "Waspada banjir" after S03 expires.
  - The AMS loading and recovery chips work.
  - Sabah in Pengguna mode shows empty lists.
  - Samarahan T5 shows the message with no lists.
  - A draft is created once without duplicates, persists after reload and can be deleted.
- **Paparan 5 (8):** fixture values, the exact target messages for 99, 95.5, 100 and negative values, the infeasible text, no NaN/Infinity, `S=0` safe, the "beli > jual" warning, and insufficient history.
- **Paparan 6 (9):** the current week shows 3 cards and 3/3/3 counts. Kelapa Tua appears only in the previous week, with no transfer button. The empty-week text is exact. The evidence toggle works. Transfer on M02 works. "Seterusnya" is disabled on the current week.
- **Failure injection (10):** a failed AI call falls back to the template. A failed map shows the 15-button list fallback, which still selects a PO. A failed Muse load shows the error, and retry works.
- **Button sweep (10):** every visible button in `#viewIntervensi` was clicked, with no pageerror (20 of 22 clicked; the other 2 were hidden or disabled at the time).
- **Responsive (12):**

  | Width | Horizontal scroll | Map height | Mode tab height | New console messages |
  |---|---|---|---|---|
  | 1440 | none | 600 | ≥ 40px | 0 |
  | 1024 | none | 460 | ≥ 40px | 0 |
  | 390 | none | 300 | ≥ 40px | 0 |

- **Old-tab regression (13):** `#filterCommodity` record count matches the backup. `#floodToggle`, `#showLogs` and the AMS scenario click work. No new console messages.
- **Console (14):** no new console errors or warnings compared with the backup baseline (baseline `[]`).

## Screenshots (all ≤ 1600px per side, no full-page shots)
`.agents/tasks/intervensi-{1440,1024,390}-{ivMapPanel,ivLogPanel,ivPriPanel,ivMobPanel,ivMarPanel,ivMusePanel}.png`, `intervensi-1440-intervensi-default-*.png`, `intervensi-{1440,1024,390}-lama.png` (viewport only). The largest is 364x1600 (390 px, Paparan 4/5 clipped). Visual check of `intervensi-1440-ivMapPanel.png` and `intervensi-1440-ivMobPanel.png`: dark navy theme, BM labels, DATA DUMMY tags visible.

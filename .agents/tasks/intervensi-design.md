# Dashboard Intervensi Komoditi: Requirements and Technical Design

Target file: `Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html` (single file, UTF-8, vanilla HTML/CSS/JS, MapLibre GL 4.7.1 from unpkg). Backup: `.agents/tasks/backup-before-intervensi.html`.
Revision: 3 (responds to the second review in `intervensi-design-review.json`, 13 findings; see Part E at the end for the disposition of each. Part D is the revision 2 history).

Hazards for the implementer:
- Line 246 is the 574 KB `const DATA = {...}` line. Never print, reformat or edit it.
- Several CSS lines are very long. Add CSS only as a new `<style id="ivStyle">` block.
- Edit with `str_replace`/`fs_write` only. PowerShell `Set-Content` round trips break the UTF-8 symbols.
- Not a git repo. Rollback is the backup file.

---

# Part A. Requirements

## A1. Summary
Add a new tab "Dashboard Intervensi Komoditi" inside the existing FAMA dashboard. The page has six linked panels (Paparan 1 to 6) and two operating modes: Mod Pengeluar (protect producers, indicator Harga Ladang, alert when price falls) and Mod Pengguna (protect consumers, indicator Harga Runcit, alert when price rises). All visible text is Bahasa Melayu (Malaysia). The dark navy theme and existing CSS variables are reused. Real data from the app is reused where it exists; everything else is dummy and labelled. No backend and no AI key in the frontend. AI output comes from a mock adapter behind a stable interface.

The existing app has no tab system today (verified: one page, no tablist, no router). A tab bar is therefore added, with the existing page content wrapped as the first tab, unchanged.

## A2. Functional requirements
- FR-1 Tab bar with two tabs: "Pemantauan Komoditi" (existing page, default) and "Dashboard Intervensi Komoditi". Existing modules keep working. The new tab is deep-linkable with `#intervensi`.
- FR-2 Header (title, subtitle) and a filter toolbar: Komoditi, Negeri, Pusat Operasi, Daerah, Tarikh / Tempoh Analisis (options 7, 14, 30 hari; see B5.10), Tahap Risiko, plus "Set Semula". Filters cascade and drive the panels as in section B8.
- FR-3 Paparan 1: MapLibre map of Malaysia with the 15 existing PO markers, in-map tabs PENGELUAR | PENGGUNA (default PENGELUAR), directional threshold alerts with supply confirmation, PO drill-down (zoom, approximate district areas, outlets by category, filters, legend, outlet popup).
- FR-4 Paparan 2: logistics readiness of the selected PO (static maximums, current availability separately, group note, missing-data message).
- FR-5 Paparan 3: priority list sorted by score, per mode, with a "Tindakan" button per row.
- FR-6 Paparan 4: deterministic mobilisation engine, two independent Top 5 lists, summary, candidate detail card, draft intervention creation (never approved or executed automatically).
- FR-7 Paparan 5: margin and price simulation with the exact definitions, formulas, history statistics, two result cards, expandable AI insight.
- FR-8 Paparan 6: weekly commodity insight from a curated dummy dataset behind a loader, mock extraction adapter, inclusion filter, week navigation, expandable cards with evidence, transfer to Paparan 3/4.
- FR-9 Loading, error, empty and stale states for every asynchronous or data-dependent area.
- FR-10 Every button, tab, chip and card has a real behaviour. No dead controls.

## A3. Non-functional requirements
- NFR-1 No new console errors or warnings on load or during any interaction (the existing app's baseline is the reference).
- NFR-2 Responsive at 1440, 1024 and 390 px wide; no horizontal page scroll.
- NFR-3 Accessibility: tablist semantics, keyboard-operable markers and cards, visible focus ring, red/yellow/green never the only cue (text label + icon), `prefers-reduced-motion` honoured (existing global rule already covers animations).
- NFR-4 Safety: all dynamic text inserted by `textContent` or the existing `esc()`; no `innerHTML` with unescaped data; no secrets; no network calls other than the existing MapLibre/CARTO ones.
- NFR-5 Offline tolerance: if MapLibre or the basemap style fails, the page still works through a non-map fallback.
- NFR-6 Re-render of one interaction completes within one animation frame for the data sizes here (15 PO, around 100 supply rows).

## A4. Acceptance criteria
1. Opening the file shows the existing dashboard unchanged, with a tab bar above it. Clicking the second tab (or loading with `#intervensi`) shows the new page and hides the old one. Clicking back restores the old page, and its map still pans and its PO clicks still work.
2. The page title is "Dashboard Intervensi Komoditi" and the subtitle is "Pemantauan Harga, Bekalan dan Cadangan Intervensi Pasaran".
3. The map shows exactly 15 PO markers with the existing IDs and coordinates, a label "lokasi anggaran bandar", and PENGELUAR selected by default.
4. Switching to PENGGUNA changes marker colours, the priority list, the filter hints, the mobilisation roles and the AI text without a page reload. Switching back restores the Pengeluar results.
5. Pengeluar: a PO with a price fall beyond the critical threshold and confirmed surplus shows red blinking. A price fall without confirmed (and fresh) surplus shows yellow only, with the reason "Menunggu pengesahan bekalan". Pengguna mirrors this for price rise and shortage. A price rise never alerts in Pengeluar and a price fall never alerts in Pengguna.
6. Clicking a PO marker zooms the map, highlights its approximate district areas, shows its outlets by category, and updates Paparan 2, 3, 4, 5 to that PO.
7. Outlet category chips filter the outlet markers; the legend lists the four categories with distinct colour and shape; an outlet popup shows nama, jenis, negeri, daerah, PO penyelia, koordinat (labelled anggaran), status operasi, komoditi berkaitan.
8. Paparan 2 for PO Kota Kinabalu shows 6 kenderaan, 16.31 MT, 6 bilik sejuk, 59.90 MT. For PO Dengkil/Selayang and Johor Baharu/Simpang Renggam it shows a group note and the same figures are not summed twice anywhere. Availability that is null shows "Data ketersediaan semasa belum tersedia".
9. Paparan 3 rows are sorted by score descending, show every field listed in B4.4, and "Tindakan" selects PO and commodity, focuses the map on the district, refreshes Paparan 4 and 5, shows a recommendation banner, and the page does not navigate or scroll away from the page.
10. Paparan 4: the two sliders always total 100 (default 65/35). Lists show at most 5 entries each, never padded, with an empty-state message when no candidate qualifies. Candidates from another zone (Semenanjung, Sabah, Sarawak) never appear.
11. Clicking a candidate opens the detail card. "Sediakan Cadangan Intervensi" creates a record with status `draf`, saved to `localStorage`, listed on the page, and survives a reload. Nothing is auto-approved.
12. Paparan 5 shows the two definitions exactly as specified, recomputes instantly on input, rejects invalid input with a Malay message, shows "Tiada julat harga yang memenuhi margin sasaran" when infeasible, and never shows a negative recommended price, NaN or Infinity.
13. Paparan 6 for the current week (9 to 15 Nov 2026) lists only records that pass the inclusion filter. The Kelapa Tua (Matag) record does not appear this week and does appear in the previous week. The empty state text is exactly "Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini". Cards expand, "Lihat Butiran Bukti" toggles evidence.
14. Every data-bearing block carries a badge "Sebenar (infografik)" or "Data dummy/prototaip". Dummy and real values are never merged into one number without a badge.
15. "Set Semula" returns all filters, mode, selection and map view to defaults and clears the selected intervention. Draft records are kept.
16. Runtime verification (section B13) passes with zero new console errors at 1440, 1024 and 390 px.

## A5. Out of scope
Real backend, FDW or API integration, real AI model calls, authentication, real district boundary polygons, real outlet coordinates, approval or execution workflow for interventions, real-time data (Paparan 6 is a daily batch), export of the new tab to CSV, changes to the existing modules' behaviour (other than the two tiny map-config exposures in B1).

## A6. Assumptions (stated, for the review to challenge)
1. "Tab inside the original dashboard" (task brief) overrides the "new page/routing" wording in the user's request. There is no router, so the tab is the route.
2. The prototype clock is fixed at `2026-11-15T12:00+08:00` (Sunday). This keeps the week tests deterministic. It is one constant in `IV_CONFIG.refNow`.
3. All existing price records (`DATA.rekod`), status labels, weather, flood, outlets and district lists are already simulated according to the app's own footer. Only PO names, the 15 approximate city coordinates and the logistics figures come from the infografik. Therefore the `sebenar` flag applies only to those.
4. Outlet category names follow the user's brief: Pasar Awam, PTK, RAKR, Agrobazaar. The existing app uses "PTKR" and "AKR" for sample outlets (no coordinates, no district). There is no confirmed mapping PTKR to PTK or AKR to RAKR, so the existing sample outlets are left untouched in the old tab and not reused as map outlets.

---

# Part B. Technical Design

## B1. Technology stack and integration points (locked on approval)

Stack: plain HTML/CSS/JavaScript (ES2020, no build step, no framework), MapLibre GL JS 4.7.1 (already loaded), existing CARTO Voyager style, inline SVG for icons and charts (as the existing app does for its trend chart), `localStorage` for drafts. No new library or CDN.

Why a second map instance is the right reuse. Alternatives considered: (a) move the existing `#map` DOM node between tabs, (b) a second `maplibregl.Map` instance on a new container. (a) is rejected because the existing map code is a closure (`map`, `mapView`, `mapMarkers`, `renderMap`, `zoomTo` are private) and its markers are rebuilt by `renderAll()` with the old state; sharing one canvas would couple the two pages and risk breaking the old one. (b) uses the same library, the same style URL and the same bounds, and creates no second map system. Chosen: (b), created lazily on first open of the tab (hidden containers have size 0).

Edits to existing code (all small and additive):

| # | Where (anchor) | Change |
|---|---|---|
| E1 | After `</style>` of `<style id="amsStyle">` (about line 181) | Insert `<style id="ivStyle">...</style>` (all new CSS, prefix `.iv-` / `#iv…`) |
| E2 | After `</header>` (line 188) | Insert `<nav class="iv-tabs" role="tablist">` with two buttons |
| E3 | Wrap lines 189 to 241 | Open `<div id="viewMonitor" class="iv-view" role="tabpanel" aria-labelledby="ivTabMonitor">` before `<div class="source-strip">`; close it after the `</section>` that closes `.bottom-grid` and before `<footer class="footer">`. No inner element, id or class changes |
| E4 | Right after that wrapper close | Insert `<div id="viewIntervensi" class="iv-view" role="tabpanel" hidden>` with the six panels (empty containers; JS fills them) |
| E5 | `const MAP_BOUNDS=...` (about line 288) | Add `const FAMA_MAP_STYLE='<same URL>';window.FAMA_MAP_CONFIG={style:FAMA_MAP_STYLE,bounds:MAP_BOUNDS};` |
| E6 | `initMap` (about line 290) | Replace the literal `style:'https://basemaps...'` with `style:FAMA_MAP_STYLE` (no other change) |
| E7 | After `initMap();` (about line 310) | Add `window.famaMonitorMapResize=()=>{if(map)map.resize()};` |
| E7b | Line 582 `initScenarios();` | Change to `window.famaScenariosReady=initScenarios();` (exposes the promise; no other change) |
| E8 | Before `</body>` (after the main `</script>`, about line 584) | Insert `<script id="ivScript">(function(){'use strict'; ... })();</script>`. The whole body is one strict-mode IIFE, so no top-level `const`/`let`/`function` can collide with the main script's global lexical scope (`state`, `map`, `labels`, `actions`, `poById`, `$`, AMS names). Existing globals (`DATA`, `esc`, `toast`, `fmt`, `money`, `SCEN_LIST`, `famaScenariosReady`) are only read inside it. The IIFE itself adds only `IV_TEST` to `window`; E5, E7 and E7b add the three properties `FAMA_MAP_CONFIG`, `famaMonitorMapResize` and `famaScenariosReady`. The complete set of added window keys is therefore exactly `FAMA_MAP_CONFIG`, `IV_TEST`, `famaMonitorMapResize`, `famaScenariosReady` |
| E9 | Last line inside the IIFE | `window.IV_TEST={...}` hooks (separate from `window.DASHBOARD_TEST`) |

Reused read-only from the existing script (top-level `const`/`let` of a classic script are visible to a second classic script): `DATA`, `esc`, `toast`, `fmt`, `money`, and, guarded with `typeof … !== 'undefined'`, `SCEN_LIST` (AMS weather/flood scenarios, used as a disruption signal).

AMS scenario timing (`SCEN_LIST` is `let SCEN_LIST=[]` and is filled asynchronously by `initScenarios()`). Chosen mechanism: the engine never caches scenarios. `ivScenarios()` reads `SCEN_LIST` on every call, and `ivRefreshScenarios()` is called (a) once when `window.famaScenariosReady` (E7b) settles, (b) every time the intervensi tab is shown, and (c) by `IV_TEST.refresh()`. The refresh recomputes a signature `SCEN_LIST.map(id|riskLevel|affectedPOIds|validUntil)` and re-renders P1 to P4 only if it changed. While the promise is pending, P4 shows the chip "Amaran cuaca/banjir AMS sedang dimuatkan" so a list produced with an empty `SCEN_LIST` is never presented as final. If the promise rejects, the chip becomes "Data AMS tidak tersedia, hanya `DATA.banjir` digunakan" and the engine continues with `DATA.banjir` alone.

Deep link and first show. The hash is applied only after both `window` `load` and `famaScenariosReady` have settled (`Promise.allSettled`), then one `requestAnimationFrame`, so the old map's `load`, `fitBounds` and the async scenario work all finish while `#viewMonitor` is still visible. Until then the page shows the old tab with the new tab button already marked "(memuatkan)" and enabled; a click before settling is queued and applied at the same point. Clicking the tab by hand is allowed at any time (the old map is then simply resized on return). The new code never writes to `DATA`, `state`, `actions` or the key `fama-demo-intervensi-v1`.

Reused CSS: variables `--bg --panel --panel2 --panel3 --line --line2 --white --muted --cyan --blue --green --yellow --red --shadow`; classes `.panel`, `.titlebar`, `.panel-title`, `.note`, `.tag`, `.button` (`.ghost`, `.tiny`), `.ctrl`, `.filterbar`, `.mini-select`, and the marker classes `.po-marker.status-hijau|kuning|merah` with `.halo`/`.core` (already blink for merah, verified by the existing test `bt/t.js` checking `animationName`). New classes are all prefixed `.iv-`; no existing selector is overridden.

Forbidden hooks inside `#viewIntervensi` (the old script binds or queries these on `document` and would hijack them; lines 285, 306, 323, 339 of the current file, re-run on every old `renderAll()`, including the call made when `initScenarios()` settles). No element inside `#viewIntervensi` may use the attributes `data-district`, `data-risk`, `data-open-action`, `data-record`, unscoped `data-po`, or the classes `.map-panel`, `.price-row`, `.risk-item`. Every new hook uses `data-iv-*` attributes and `.iv-*` classes. The "reused" marker classes (`.po-marker`, `.halo`, `.core`, `.status-*`) are safe because the old script only queries them inside `#map`. The monitor wrapper `#viewMonitor` and the new view share no element ids (all new ids start with `iv`). B13 step 3c asserts this.

Tab behaviour: `role=tablist` with two `role=tab` buttons, `aria-selected`, `aria-controls`, Left/Right arrow keys, `Home`/`End`. Switching toggles the `hidden` attribute and `.iv-view[hidden]{display:none!important}`. On first show of the new tab: create the map (inside `requestAnimationFrame` after unhiding), then render. On every show: `ivMap.resize()`. On return to the old tab: `window.famaMonitorMapResize()`. The URL hash `#intervensi` / `#pemantauan` is read after load and scenario settle (see "Deep link and first show" above) and written on switch with `try{history.replaceState(null,'','#intervensi')}catch(_){location.hash='intervensi'}` (and the same for `#pemantauan`). `replaceState` avoids history spam and scroll jump; the `catch` covers browsers that throw a `SecurityError` on `file://`, where `location.hash` is the fallback. A failure of either never blocks the tab switch.

## B2. Namespaced state (single new object, no second state system)

One object `ivState`, mutated only through `ivDispatch(action, payload)`.

```js
const ivState = {
  selectedMode: 'pengeluar',          // 'pengeluar' | 'pengguna'
  selectedCommodityId: null,          // null = Semua; else 'cili-merah' ...
  selectedStateId: null,              // slug of negeri, e.g. 'johor'
  selectedDistrictId: null,           // 'johor/kluang'
  selectedPOId: null,                 // existing DATA.po id, e.g. 'simpangrenggam'
  selectedOutletId: null,
  selectedDateRange: { days: 30 },    // 7 | 14 | 30 (control labelled "Tarikh / Tempoh Analisis"; baseline window, not a date picker)
  selectedRisk: 'all',                // 'all'|'kritikal'|'waspada'|'normal'
  selectedInterventionId: null,       // priority row id
  selectedSourcePOId: null,
  selectedDestinationPOId: null,
  // panel-local (still inside the same object)
  outletCats: { 'pasar-awam':true, 'ptk':true, 'rakr':true, 'agrobazaar':true },
  mob: { needMT: null, refPrice: null, wPrice: 65, distLimitKm: 550, candidateKey: null },
  margin: { jual:null, beli:null, ladang:null, kos:null, target:15, touched:false },
  muse: { weekStart:'2026-11-09', expandedId:null, evidenceOpen:{}, status:'loading' },
  ui: { mapReady:false, mapError:null, loading:{}, errors:{} }
};
```

Rules: `selectedStateId` and `selectedPOId` stay consistent (selecting a PO sets its state; selecting a state that does not contain the selected PO clears the PO and district). `wDist = 100 - wPrice` is derived, never stored, so the two weights cannot drift. Draft interventions live in a separate array `ivDrafts` persisted as `fama-iv-draf-v1`.

Effective values used by panels 4 and 5 (so "Semua komoditi" or "no PO" never causes a silent guess):
- `effPO()` = `selectedPOId`, else the PO of `selectedInterventionId`, else `null`. `null` shows the empty state "Pilih Pusat Operasi pada peta atau senarai keutamaan".
- `effCommodity()` = `selectedCommodityId`, else the commodity of `selectedInterventionId`, else `'cili-merah'`. When it came from the default, the panel shows the chip "Komoditi panel: Cili Merah (lalai, penapis ialah Semua)".
- Unit guard: only commodities with unit `RM/kg` are supported in panels 4 and 5. `Telur Gred A` (`RM/10 biji`) shows "Unit komoditi (RM/10 biji) tidak disokong untuk pengiraan MT dan RM/kg. Pilih komoditi RM/kg." instead of a calculation.

## B3. Data modules, schemas and the real/dummy flag

Every record carries `source` (`'sebenar'` or `'dummy'`) and `origin` (`'DATA.po'`, `'DATA.po.logistik'`, `'DATA.rekod'`, `'iv'`). Badge text: `sebenar` renders "Sebenar (infografik)"; `dummy` renders "Data dummy/prototaip". Existing simulated records (`origin:'DATA.rekod'`) are `dummy`, because the app itself states they are simulated; the origin shows that they are reused. Modules are plain frozen objects/arrays at the top of `ivScript` under a `/* ===== MODUL DATA ===== */` banner, each separated from the others, and loaded through `ivDataService` (B9).

### B3.1 PO (derived view of `DATA.po`, no copy of values)
`{ id, name, negeri, stateId, zone, lat, lon, coordApprox:true, logisticsGroupId, source:'sebenar', origin:'DATA.po' }`.
`id`, `name`, `negeri`, `lat`, `lon` are the existing values (IDs: perlis, kedah, penang, perak, selangor, selayang, negerisembilan, melaka, kelantan, terengganu, pahang, johor, simpangrenggam, sabah, sarawak). `stateId` = slug of `negeri`. `zone` = `'Sabah'` for sabah, `'Sarawak'` for sarawak, else `'Semenanjung'`. Names come from `DATA.po[].name` unchanged (so the app's "PO Johor Baharu" is shown, id `johor`); the brief's spelling "Johor Bahru" is the district name, which is also kept as in `DATA.po[].districts`. Marker caption: "Lokasi anggaran bandar, bukan koordinat bangunan PO". Marker label offsets: copy the existing `labelShift` table into `IV_CONFIG.labelShift` (15 pairs; duplicated data accepted over editing the long line 300).

### B3.2 District mapping (explicit, dummy)
`IV_DISTRICT_MAP`: one record per entry of `DATA.po[].districts`:
`{ districtId:'johor/kluang', name:'Kluang', stateId:'johor', poId:'simpangrenggam', lat, lon, coordApprox:true, mappingStatus:'dummy-sah', source:'dummy', origin:'DATA.po.districts' }`.
The 15 PO and their 50 districts come from the existing app's simulated "daerah seliaan"; `mappingStatus:'dummy-sah'` means "sah untuk prototaip sahaja". `IV_GAZETTEER` lists extra district names with state but no PO (for example Dungun, Kemaman, Besut in Terengganu), used only by the AI Muse extractor. A district not in `IV_DISTRICT_MAP` is `mappingStatus:'tidak-disahkan'` and is never matched to a PO. Assignment is by this table, never by nearest PO.

### B3.3 Outlet
`{ outletId:'OUT-JHB-01', nama:'Pasar Awam Kluang (Contoh)', kategori:'pasar-awam'|'ptk'|'rakr'|'agrobazaar', stateId, districtId, supervisingPOId, lat, lon, coordApprox:true, status:'Beroperasi'|'Tidak beroperasi'|'Data tidak tersedia', komoditiBerkaitan:[commodityId], assignmentStatus:'dummy-sah'|'tidak-disahkan', source:'dummy', origin:'iv' }`.
Rules: `supervisingPOId` is derived from the district map at load; if the district is unmapped, `supervisingPOId=null` and `assignmentStatus:'tidak-disahkan'`. Coordinates are the district centroid plus a fixed deterministic offset (at most 0.04 degrees), labelled "koordinat anggaran (dummy)". Authoring set: 0 to 3 outlets per district (about 60 total). Hard rules: each of the 4 categories has at least 3 outlets overall; every PO has at least 1 outlet in its mapped districts (so no PO drill-down is empty); the only outlet-less districts are Jasin (Melaka) and Jelebu (Negeri Sembilan), kept as deliberate gaps. Required named outlets (all dummy, names end with "(Contoh)"): Kluang (simpangrenggam): `OUT-KLU-01` Pasar Awam Kluang (pasar-awam), `OUT-KLU-02` Agrobazaar Kluang (agrobazaar), `OUT-KLU-03` RAKR Kluang (rakr); Johor Bahru (johor): `OUT-JHB-01` Pasar Awam Larkin (pasar-awam), `OUT-JHB-02` PTK Johor Bahru (ptk), `OUT-JHB-03` Agrobazaar Johor Bahru (agrobazaar); Pasir Mas (kelantan): `OUT-PMS-01` Pasar Awam Pasir Mas (pasar-awam), `OUT-PMS-02` PTK Pasir Mas (ptk), `OUT-PMS-03` RAKR Pasir Mas (rakr). Each has `komoditiBerkaitan` including `cili-merah` (Kluang, Johor Bahru) or `bawang-merah-kecil` (Pasir Mas) so T1, T2 and T3 show relevant outlets. `IV_TEST.outletStats()` returns the per-category and per-PO counts so B13 can assert these rules. The map panel shows a permanent note: "Outlet di sini ialah data dummy yang berasingan daripada outlet contoh dalam tab Pemantauan Komoditi." (the old tab's 3 sample outlets per PO, with different names and no district, are not reused). Two outlets sit in unmapped districts (for example Kemaman) and show only in a collapsed list "Outlet tanpa PO penyelia disahkan (dummy)", never on a PO drill-down.

### B3.4 Commodity and CommodityPrice
`IV_COMMODITIES` derives from `DATA.komoditi`: `{ commodityId: slug(name), name, unit, base, floor, ceiling, source:'dummy', origin:'DATA.rekod' }` (7 items).
`CommodityPrice` is computed per `(poId, districtId, commodityId, stage)` by `ivPrice()` from the matching `DATA.rekod` entry (`prices` last value as `actual`, `ramalan` as `forecast`, `hargaLantai`/`hargaSiling` as absolute `floor`/`ceiling`, `unit`, `peringkat` as `priceLevel`: Ladang | Borong | Runcit):
`{ actual, forecast, baseline, devPct, forecastDevPct, thresholdLow, thresholdHigh, floor, ceiling, unit, priceLevel, windowDays, overlay:null|{id,note}, source:'dummy', origin:'DATA.rekod' }`.
- `baseline` = mean of the last `selectedDateRange.days` values of `prices` (7, 14 or 30). This reuses the existing 30-day data and keeps `purata` consistent for 30.
- `devPct = (actual - baseline) / baseline * 100`; `forecastDevPct` likewise for `forecast`.
- `thresholdLow = baseline * (1 + warnPctProducer/100)` and `thresholdHigh = baseline * (1 + warnPctConsumer/100)` (derived from config B5.1). These are the same warning thresholds B5.2 uses for both `actual` and `forecast`; the forecast column shows the same `thresholdLow`/`thresholdHigh`, so one threshold definition exists.
- Scenario overlay (`IV_PRICE_OVERLAY`, dummy): rows `{ poId, districtName, commodityId, stage, devPct, forecastDevPct, note }` replace `actual`/`forecast` with `baseline*(1+dev/100)`. Used only to create the required test scenarios (B11). A price with an overlay carries `overlay` and the UI shows a badge "Senario ujian (dummy)" next to the number, so a base value is never silently replaced.

Finding to record: the existing `rekod.status` and `sebab` text (for example "2.8σ daripada purata 30 hari") do not agree with the stored `prices` series, and the status is direction-neutral. The new engine therefore does not use `rekod.status` for classification. It recomputes direction-aware levels from the series. The old status is only shown in Paparan 3's detail as "Status dashboard asal (tanpa arah)".

### B3.5 CommoditySupply (dummy)
`{ poId, commodityId, availableStockMT, reservedMT, requiredMT, surplusMT, shortageMT, coverage, lastUpdated:'2026-11-15T06:00:00+08:00', stockVerified:boolean, source:'dummy', origin:'iv' }`.
Derived: `net = availableStockMT - reservedMT`; `surplusMT = max(0, net - requiredMT)`; `shortageMT = max(0, requiredMT - net)`; `coverage = requiredMT > 0 ? net / requiredMT : null`.
Authoring: a deterministic generator `seed(poId + commodityId)` (a 32-bit string hash, mulberry32) assigns an archetype (surplus 35 %, balanced 40 %, shortage 25 %) and values (available 4 to 20 MT, reserved 0 to 2, required 3 to 12), `lastUpdated` within the last 24 h, `stockVerified:true`. Explicit `IV_SUPPLY_OVERRIDE` rows then fix the test scenarios (B11). Output is a fixed array of 105 rows (15 PO x 7 commodities), generated once at load. Because generated rows are random-looking noise, they are used for lists and scoring only where a scenario does not pin them; every row used by a required test is fixed in `IV_SUPPLY_OVERRIDE` (B11). The generated archetype never changes a price level by itself (B5.4 row 4), so generated surplus or shortage cannot paint the map.

### B3.6 Logistics
`{ poId, logisticsCapacityGroupId, kenderaanMax, muatanMaxMT, bilikSejukMax, simpananMaxMT, groupShared, groupMemberPOIds, availableVehicleCount:null|number, availableCapacityMT:null|number, actualStockMT:null|number, availabilityUpdated:null|ISO, source:'sebenar' (for the Max fields), availSource:'dummy' }`.
The `*Max` fields come from `DATA.po[].logistik` and `DATA.po[].logistikGroup` (real, infografik). Field meanings, one each:
- `availableVehicleCount`: number of vehicles currently free (compared with `kenderaanMax`; used by the delivery cap in B5.6 as `availableVehicleCount * muatanMaxMT / kenderaanMax`).
- `availableCapacityMT`: free storage space in MT, "ruang simpanan kosong", compared with `simpananMaxMT` only. It is never a vehicle load figure and never enters the delivery cap. No separate load field is added (YAGNI).
- `actualStockMT`: stock physically held, informational, never derived from the maximums.
Current availability is `null` unless a row exists in `IV_LOGISTICS_AVAIL`. That object is keyed by `logisticsCapacityGroupId` (not by PO), so both members of a shared group show the same availability. Explicit dummy values (all `availSource:'dummy'`, `availabilityUpdated:'2026-11-15T06:00:00+08:00'`):
```js
IV_LOGISTICS_AVAIL = {
  johor_simpang: { availableVehicleCount:5, availableCapacityMT:62.0, actualStockMT:92.4 }, // johor + simpangrenggam; max 7 kenderaan, 154.4 MT simpanan
  ayerkeroh:     { availableVehicleCount:6, availableCapacityMT:28.0, actualStockMT:6.6  }, // melaka; max 7 kenderaan, 34.6 MT simpanan
  kotabaharu:    { availableVehicleCount:1, availableCapacityMT:1.5,  actualStockMT:8.6  }  // kelantan; max 9 kenderaan, 10.1 MT simpanan
};
```
Consistency rule: `actualStockMT + availableCapacityMT = simpananMaxMT` (62.0 + 92.4 = 154.4; 28.0 + 6.6 = 34.6; 1.5 + 8.6 = 10.1). Resulting readiness `r` (B4.3): johor_simpang 0.558 Terhad; ayerkeroh 0.833 Sedia; kotabaharu 0.130 Kritikal. Note the real field names in `DATA` are `kenderaan`, `muatanMT`, `bilikSejuk`, `kapasitiSimpananMT`; the module maps them to the schema names above. The vehicle delivery cap for simpangrenggam is `5 * 26.98 / 7 = 19.27` MT, which does not bind in T2 (surplus 12).
`logisticsCapacityGroupId` is `DATA.po[].logistikGroup` for every PO (all 15 have one; verified: kangar, alor, perai, simpangpulai, dengkil_selayang x2, seremban, ayerkeroh, kotabaharu, kualaterengganu, kuantan, johor_simpang x2, kotakinabalu, samarahan). The readiness verdicts for these rows are asserted in B13 step 5 (see B4.3). For grouped POs (`dengkil_selayang`, `johor_simpang`) the group figures are one record keyed by `logisticsCapacityGroupId`; any total over POs counts each group once.

### B3.7 Intervention (draft record)
`{ interventionId:'IV-20261115-001', mode, status:'draf', createdAt (ISO, from refNow), sourcePOId, destinationPOId, commodityId, quantityMT, distanceKm, transportCostPerKg, netGapPerKg, score, justification, deliveryRisk, stockVerification:'belum disahkan'|'disahkan (dummy)', weights:{price,dist}, createdBy:'prototaip', source:'dummy' }`.
The id suffix `NNN` is `max(suffix of existing drafts with the same date) + 1`, zero-padded to 3 digits (1 when none), so deleting a draft never reuses an id. The only status the UI can create is `draf`. No code path writes any other status.

### B3.8 AiMuseInsight
Raw curated note (`IV_MUSE_RAW`, dummy) `{ rawId, recordDate, analystNote, sourceName, sentimentIndex, sampleCount, riskBefore, riskCurrent, riskForward }`. Extracted insight (output of the adapter, then filtered):
`{ insightId, commodityId|null, commodityLabel, eventDate, recordDate, location:{label,type}, stateId, districtId, matchedPOId|null, locationConfidence:0..1, locationType:'disahkan'|'disebut'|'belum', riskBefore, riskCurrent, riskForward, riskBand:'hijau'|'kuning'|'merah', sentimentIndex, sampleCount, analystNote, evidence:[{quote,sourceName,date}], suggestedActions:[string], summary, explanation, source:'dummy', origin:'iv' }`.
`locationType` labels: "Lokasi acara disahkan", "Lokasi hanya disebut", "Lokasi belum disahkan".
`riskBand` from `riskCurrent` (configurable in `IV_CONFIG.museBands`): hijau below 20, kuning 20 to 39, merah 40 and above. This matches the reference card (current 16 shows "Hijau"). Change = `riskCurrent - riskBefore`.

## B4. Panel designs

### B4.1 Layout and DOM
```
#viewIntervensi
  .iv-head        h2 + subtitle + .iv-badge-row
  .iv-filters     6 controls + Set Semula
  .iv-grid-top    grid-areas: "map logistik" / "map priority"
     #ivMapPanel (P1)   #ivLogPanel (P2)   #ivPriPanel (P3)
  #ivMobPanel (P4)      full width
  #ivMarPanel (P5)      full width
  #ivMusePanel (P6)     full width
  #ivDraftPanel         full width, collapsible "Draf Cadangan Intervensi" list (below P4 logically, placed after P4)
```
Panel chrome reuses `.panel` + `.titlebar`. Each panel title has a data badge and, where a filter does not apply, a chip "Penapis tidak terpakai".

### B4.2 Paparan 1: map
Container `#ivMap` inside `.iv-map-frame`. Instance created with `new maplibregl.Map({container:'ivMap', style:FAMA_MAP_CONFIG.style, bounds:FAMA_MAP_CONFIG.bounds, fitBoundsOptions:{padding:20}, cooperativeGestures:true, dragRotate:false, pitchWithRotate:false, locale:{...Malay strings copied from the existing map}})` plus `NavigationControl`. Bounds cover Peninsula, Sabah and Sarawak.

In-map tabs (top-left overlay, `position:absolute`, z-index above canvas): a `role=tablist` with "PENGELUAR" and "PENGGUNA", at least 40 px high, large type, selected tab filled (green tint for Pengeluar, blue tint for Pengguna). Under it a one-line hint: "Penunjuk: Harga Ladang · amaran apabila harga turun" or "Penunjuk: Harga Runcit · amaran apabila harga naik".

Marker colour and blink = `poLevel(poId)` (B5.4): `normal` -> `status-hijau`, `waspada` -> `status-kuning`, `kritikal` -> `status-merah` (existing class gives the blink). Each marker has `aria-label` "PO Kangar, Kritikal" and a text title. POs hidden by the Tahap Risiko filter or Negeri filter are removed from the map (not dimmed), the same pattern the existing page uses (`statePOs()`). Exception: the selected PO is never removed. If the selected PO no longer passes the Negeri or Tahap Risiko filter (or has no records for the Komoditi filter), the selection is kept, its marker stays visible with a dashed ring, and the P1 header shows the chip "Terpilih (di luar penapis)". Panels P2 to P5 keep showing it. Clearing the filter or clicking "Malaysia" removes the chip.

Drill-down on PO click (`selectPO`): `map.fitBounds` over the PO point plus its district centroids (padding 60, maxZoom 10, duration 700, same as the existing `applyMapView`); draw approximate district areas; draw outlet markers; set panels.
- District areas: GeoJSON source `iv-districts`, `fill` layer (opacity 0.12, colour by district level) and `line` layer (dashed). Each polygon is a 24-vertex circle of radius 10 km around the dummy district centroid. Caption "Kawasan anggaran daerah (bukan sempadan rasmi). Tiada data sempadan tersedia." No boundary data exists in the app (`DATA.mapPaths` only has four country outlines), so none is invented. Selected district: thicker outline. Clicking a district marker toggles `selectedDistrictId`.
- District level colour = the worst `devLevel` among that district's records for the mode and commodity filter.
- Outlet markers: HTML markers 22 px with category colour, shape and 2-letter glyph. Pasar Awam: blue circle "PA". PTK: violet square "PT". RAKR: orange diamond "RK". Agrobazaar: teal triangle "AB". These do not use red, yellow or green, so they never read as risk. Selected outlet gets a ring.
- Outlet chips (`outletCats`): four toggle buttons with counts. Legend (compact, bottom-left): the four icons plus the three risk colours and "Merah berkelip: kritikal disahkan bekalan".
- Outlet click: `selectedOutletId` set and a `maplibregl.Popup` opened with `setDOMContent` (built by `textContent`), fields as in AC-7, plus the dummy badge.
- Button "Malaysia" (visible when a PO is selected): sets `selectedPOId=null`, fits Malaysia bounds.
- Missing district mapping for the selected PO: banner "Pemetaan daerah untuk PO ini belum disediakan. Daerah dan outlet tidak dipaparkan." and no area/outlet layers. A mapped district with zero outlets: the district chip list shows "Tiada outlet dalam daerah ini".
- Map load failure or `typeof maplibregl==='undefined'`: `.iv-map-fallback` replaces the canvas with a keyboard-focusable grid of the 15 PO buttons coloured by level, a message "Peta tidak dapat dimuatkan. Pilihan PO melalui senarai masih berfungsi." and a "Cuba Semula" button (re-creates the map). Everything else keeps working.
- Loading: a skeleton with "Memuatkan peta…" until the map `load` event; a 10 s timer moves to the failure state if `load` never fires.

### B4.3 Paparan 2: Kesiapsiagaan Logistik PO
Four stat tiles with SVG icons (truck, snowflake/cold room, warehouse): Bilangan Kenderaan, Kapasiti Muatan (MT), Bilangan Bilik Sejuk, Kapasiti Simpanan (MT), each labelled "maksimum statik" and badged "Sebenar (infografik)". Below, a second block "Ketersediaan semasa" shows `availableVehicleCount`, `availableCapacityMT`, `actualStockMT` with the "Data dummy/prototaip" badge, or the single line "Data ketersediaan semasa belum tersedia" when null. Readiness chip:
- all availability null -> grey "Kesiapsiagaan tidak dapat dinilai" (never inferred from the maximums);
- else `r = 0.5*availableVehicleCount/kenderaanMax + 0.5*availableCapacityMT/simpananMaxMT` (`availableCapacityMT` is free storage space, see B3.6) (fields that are null are dropped and the weight redistributed; if both null, grey); `r >= 0.6` Sedia (green), `0.3 <= r < 0.6` Terhad (yellow), `< 0.3` Kritikal (red).
Header shows PO name, negeri and "lokasi anggaran". Group note for shared groups: "Angka gabungan PO Dengkil dan PO Selayang. Tidak digandakan." (and the Johor Baharu / Simpang Renggam equivalent), plus a link-chip to the partner PO. No PO selected: empty state "Pilih Pusat Operasi pada peta untuk melihat kesiapsiagaan logistik".

### B4.4 Paparan 3: Senarai Keutamaan Intervensi
Rows are built from `DATA.rekod` records of the mode's price stage (Pengeluar: `Ladang`; Pengguna: `Runcit`), one per `(poId, district, commodity)`, run through `ivClassify()` (B5). Only rows with level `kritikal` or `waspada` are listed (normal rows are never listed). Sorted by `score` descending, then level, then name.

Row fields: red or yellow dot (plus the text "Kritikal"/"Waspada"), Daerah, Negeri, PO, Komoditi, jenis isu (rule below), harga semasa, harga forecast, tahap risiko, jenis intervensi, skor, and a "Tindakan" button. Jenis isu rule (one label per row, no other labels exist): if the actual price level is `waspada` or `kritikal`, the base label is "Harga ladang jatuh" (Pengeluar) or "Kenaikan harga runcit" (Pengguna); otherwise (the row is listed on forecast alone) it is "Ramalan di bawah ambang" (Pengeluar) or "Ramalan di atas ambang" (Pengguna). When `supplyConfirm` is `disahkan`, append " + lebihan bekalan disahkan" (Pengeluar) or " + kekurangan bekalan disahkan" (Pengguna). There are no stand-alone supply labels, because under B5.4 a row needs a price signal to be listed. The brief's examples "Harga ladang jatuh" with Kritikal and "Kenaikan harga runcit" with Kritikal are produced as the base label plus the suffix.
Intervention type text by mode and condition:
- Pengeluar critical: "Pengumpulan dan pengedaran semula bekalan"; waspada: "Pantau dan sedia pembelian lebihan".
- Pengguna critical: "Mobilisasi stok tambahan"; waspada: "Pantau bekalan dan sedia stok sokongan".
Row id = `${mode}:${poId}:${districtId}:${commodityId}`. Rows capped at 12 with "Papar semua (N)" toggle. Empty states: "Tiada isu keutamaan untuk penapis ini" and, when rows were excluded because supply is unconfirmed, a footnote "N isu harga menunggu pengesahan bekalan".

"Tindakan": dispatch `selectIntervention(id)`: sets `selectedInterventionId`, `selectedPOId`, `selectedStateId`, `selectedDistrictId`, `selectedCommodityId`, role fields (B7), pans the map to the district with `fitBounds`, recomputes Paparan 4 and 5, writes a banner in the priority panel ("Cadangan: …" one sentence from the adapter fallback template), calls `toast('Intervensi dipilih: …')`, and moves focus to the banner with `banner.focus({preventScroll:true})` (the page has `scroll-behavior:smooth`, so a plain `focus()` would scroll). It never changes the tab and never scrolls the page; if Paparan 4 is out of view, the banner includes a "Lompat ke Paparan 4" button (user-initiated scroll).

### B4.5 Paparan 4: AI Smart Stock Mobilisation
Layout follows the reference image: header card, inputs, "Ringkasan Cadangan Mobilisasi", two columns.
- Header card: role label ("PO SUMBER, lebihan stok" in Pengeluar; "PO DESTINASI, kekurangan stok" in Pengguna), PO name, negeri, commodity, "Peringkat Borong", stat tiles (harga, keperluan or lebihan MT, harga rujukan).
- Inputs: `needMT` (number 0.1 to 500, step 0.1, default = shortage or surplus of the selected PO/commodity, "dari data dummy"), `refPrice` (RM/kg, number 0.01 to 999, default = PO Borong price, editable and labelled "ditetapkan pengguna" when changed, with a "Pulih lalai" link), two linked sliders (below), `distLimitKm` (number 50 to 2000, default 550).
- Weight sliders: one `<input type=range min=0 max=100 step=5>` "Wajaran harga" bound to `mob.wPrice`; the second slider "Wajaran jarak/kos" is a second range input bound to `100 - wPrice`; moving either sets `wPrice` (the other updates). Label "65% / 35%". Total is always 100 by construction.
- Two independent columns "Top 5 PO Dalam Negeri" (same `negeri` as the anchor PO) and "Top 5 PO Luar Negeri" (other negeri, same zone). Each is ranked on its own (scores are computed from min-max over its own eligible set, see B5.6), and each shows only its eligible entries (0 to 5). Empty copy: "Tiada PO dalam negeri yang layak. Sistem tidak menambah calon yang tidak memenuhi syarat." and the equivalent for luar negeri.
- Candidate card: kedudukan, nama PO, negeri, lebihan stok (Pengguna) or keperluan (Pengeluar), harga sumber/destinasi, anggaran jarak, kos pengangkutan (RM/kg), jurang harga bersih (RM/kg), skor /100, anggaran kuantiti boleh dihantar (MT), shared-group and flood-risk chips. Entire card is a button (keyboard operable).
- Detail card on click (`mob.candidateKey`): PO sumber, PO destinasi, komoditi, kuantiti, jarak, kos (RM/kg and total RM), justifikasi (calculated bullets), risiko penghantaran (flood/weather flag, shared logistics, unknown vehicle availability), status pengesahan stok ("Belum disahkan" for dummy stock; the UI never states stock is verified), and the button "Sediakan Cadangan Intervensi".
- Draft button: creates the draft (B3.7), saves, announces "Draf cadangan intervensi disediakan (status: draf)", adds to the visible list "Draf Cadangan Intervensi" with a "Padam Draf" button per row. Double click is guarded: a draft with the same `(sourcePOId, destinationPOId, commodityId, quantityMT)` and status `draf` is not duplicated and the user gets "Draf yang sama sudah wujud".
- "Ringkasan Cadangan Mobilisasi": calculated block (PO terpilih, mengapa, dalam atau luar negeri, kuantiti, kos pengangkutan, jurang harga bersih, kekangan, faedah) with a plain card, then the AI narrative below in a visually distinct card (violet dashed border, header "Ringkasan AI (simulasi, bukan keputusan)"). The narrative never introduces numbers that are not in the calculated block.
- "N PO ditapis keluar" disclosure lists every excluded PO with its reason.

### B4.6 Paparan 5: AI Margin & Price Simulation
Definitions block (always visible, not collapsible, exact wording):
- "Harga Borong Beli: harga yang FAMA PO jual kepada pemborong luar."
- "Harga Borong Jual: harga jualan borong yang diperhatikan dan dikutip oleh FAMA di pasaran terbuka."
- "Spread = Harga Borong Jual − Harga Borong Beli. Spread bukan margin operasi PO."

Naming bridge in the UI under the formula block: "Harga Jualan PO (dalam formula) = Harga Borong Beli."
Summary tiles: Harga Borong Beli, Harga Borong Jual, Spread Semasa, Margin Operasi PO Semasa.
Inputs (numeric plus range, two-way bound, recompute on `input`): PO (read-only, from `effPO()`, with a select to change it), Komoditi (read-only chip from `effCommodity()`), Harga Borong Jual, Harga Borong Beli, Harga Belian Ladang, Kos Operasi (RM/kg), Margin Sasaran (%). Defaults come from the dummy history and `DATA.rekod` (B5.8) and are re-seeded when PO or commodity changes (unless `margin.touched`, in which case a "Pulih nilai lalai" button is shown).

Formulas (margin as a percentage; `S` = Harga Jualan PO = Harga Borong Beli, `F` = Harga Belian Ladang, `C` = Kos Operasi, `t` = target as decimal):
- `Margin% = ((S - F - C) / S) * 100`
- `MaxFarmPrice = ExpectedSell * (1 - t) - C`, with `ExpectedSell = S`
- `MinSell = (F + C) / (1 - t)`

Result cards:
- Green "Cadangan Harga Belian Ladang": range `[farmLow, MaxFarmPrice]` where `farmLow = max(0, hargaLantai of the PO's Ladang record)`; "Harga belian maksimum"; margin impact = `margin at MaxFarmPrice (= target)` minus `current margin`, in percentage points. Infeasible when `MaxFarmPrice < farmLow` or `MaxFarmPrice <= 0`.
- Cyan "Cadangan Harga Jualan Borong PO": market-supported range `[mLow, mHigh]` (B5.8), recommended range `[max(MinSell, mLow), mHigh]`, "Harga minimum untuk margin sasaran" = `MinSell`, profitability = margin at the range ends. Infeasible when `MinSell > mHigh`, or history is insufficient (then the range is hidden and MinSell is still shown).
- Infeasible text: exactly "Tiada julat harga yang memenuhi margin sasaran" in the affected card. Nothing negative is ever rendered: any negative or non-finite value is replaced by "—".
- Historical block: average, median, standard deviation (population), trend (naik, turun, stabil) of the spread, and the market-supported range. If fewer than `margin.minHistory` (8) points: warning "Data sejarah tidak mencukupi (N minggu, perlu sekurang-kurangnya 8). Julat sokongan pasaran tidak dipaparkan." The text "optimum statistik" is never used; the result copy says "julat dicadangkan, bukan nilai optimum".
- Expandable "Pandangan AI Margin" (`<details>`-like button with `aria-expanded`): margin semasa lawan sasaran, kemampanan harga belian, kecukupan harga jualan, risiko harga jatuh, cadangan pelarasan, then the note "Nasihat sahaja dan tertakluk kepada pengesahan operasi." Text from `aiAdapter.explainMargin()`; the figures quoted come only from the engine.

### B4.7 Paparan 6: AI Muse, Weekly Commodity Insight
Header: "AI Muse - Weekly Commodity Insight" / "Isu Komoditi Mengikut Lokasi dan Minggu", badge "Data pilihan (dummy)". Statistics tiles: Minggu Analisis (selector: "◀ 9 – 15 November 2026 ▶", Monday to Sunday, UTC+8; "Minggu ini" button; next is disabled beyond the week of `refNow`), Tarikh Data Terakhir, Status Pemprosesan (Siap / Sebahagian / Gagal), Bilangan Isu Mingguan, Bilangan Lokasi Dikenal Pasti, Bilangan Komoditi Terlibat. A static note: "Kemas kini secara kelompok harian, bukan masa nyata."
Card (collapsed): commodity, state/district, summary, risk band chip, risk before, risk current, change, sentiment index, sample count, source, recommended action. Expanded (click or Enter): detailed insight, extracted location with its location-type label, evidence list (hidden until "Lihat Butiran Bukti" is toggled, `aria-expanded`), risk sparkline (inline SVG of `riskBefore -> riskCurrent -> riskForward`), relevant PO only if verified, suggested actions. If `matchedPOId` is valid and `commodityId` exists in `IV_COMMODITIES`, show "Hantar Konteks ke Senarai Keutamaan dan Mobilisasi" which dispatches `museTransfer`. Otherwise show the note "Padanan daerah kepada PO masih memerlukan pengesahan." and no button (the button is not rendered, not just disabled).
Empty state, exact: "Tiada isu sentimen berlokasi yang memenuhi kriteria minggu ini".
Negative sentiment alone is never described as shortage. The card shows "Sentimen negatif" and its own risk band; no "kekurangan bekalan" claim unless the note carries a supply keyword and the Paparan 4 data confirms it.

## B5. Rules, formulas and ambiguity decisions

### B5.1 Threshold configuration (configurable, one object)
```js
IV_CONFIG.thresholds = {
  pengeluar: { direction:'turun', warnPct:-8,  critPct:-15, stage:'Ladang' },
  pengguna:  { direction:'naik',  warnPct: 8,  critPct: 15, stage:'Runcit' }
};
IV_CONFIG.supply = { minSurplusMT:3, minSurplusRatio:0.15, shortageCoverage:0.8, staleHours:72 };
```
A "Tetapan Ambang" disclosure in the toolbar shows these four numbers per mode with number inputs (validated: warn between 1 and 50, crit greater than warn and at most 90, in absolute value). Changing them re-renders everything. Reset restores defaults. There is no existing configurable price threshold engine to reuse (the existing page only has σ lines and a floor/ceiling per commodity). What is reused: the σ-based chart lines are untouched, and `hargaLantai`/`hargaSiling` are used as absolute hard limits: a Pengeluar price at or below `hargaLantai` counts as a critical price signal; a Pengguna price at or above `hargaSiling` likewise. The percentage thresholds above are new and labelled "Ambang prototaip (boleh ditetapkan)".

### B5.2 Directional price level
`harm = mode==='pengeluar' ? -devPct : devPct` (positive means movement in the harmful direction). `harmF` likewise for forecast.
- `priceLevel = 'kritikal'` if `harm >= |critPct|` or the absolute floor/ceiling rule fires;
- `'waspada'` if `harm >= |warnPct|`, or `harmF >= |warnPct|` (forecast beyond the same warning threshold: below `thresholdLow` in Pengeluar, above `thresholdHigh` in Pengguna, as shown in B3.4). The forecast alone can raise a level to waspada only, never to kritikal;
- else `'normal'`.
A movement in the other direction is `normal` for the mode. This is what makes the two modes alert in opposite directions.

### B5.3 Supply confirmation
`supplyConfirm(mode, supplyRow)` returns `{ state:'disahkan'|'tidak-disahkan'|'lapuk'|'tiada', reason }`:
- `tiada`: no supply row or `requiredMT`/stock missing.
- `lapuk`: `refNow - lastUpdated > staleHours` (72 h).
- Pengeluar `disahkan`: `surplusMT >= max(minSurplusMT, minSurplusRatio * net)` (oversupply).
- Pengguna `disahkan`: `coverage !== null && coverage < shortageCoverage` and `shortageMT >= minSurplusMT` (shortage).
- otherwise `tidak-disahkan`.

### B5.4 Final risk level (price alone is never critical)
| Price level | Supply `disahkan` | Result |
|---|---|---|
| kritikal | yes | **kritikal** (red, blinking) |
| kritikal | no, lapuk or tiada | **waspada**, flag "Menunggu pengesahan bekalan" or "Data stok lapuk" |
| waspada | any | waspada |
| normal | `disahkan` | **normal**, with the informational chip "Isyarat bekalan awal" only. The chip does not change marker colour, level counts, Tahap Risiko filter results, or Paparan 3 row inclusion. Reason: the brief defines yellow as price approaching a threshold, and supply confirmation escalates a price signal but never creates one |
| normal | otherwise | normal |
PO level = worst level among its records for the mode, commodity filter and Tempoh. District level likewise. Tahap Risiko filter compares to this final level.

### B5.5 Priority score (0 to 100)
`score = round(100 * (0.45*P + 0.35*S + 0.10*F + 0.10*C))` where
- `P = clamp(harm / (2*|critPct|), 0, 1)` (price severity in the harmful direction);
- `S = clamp(gap, 0, 1)` with `gap = surplusMT / max(net, 1)` for Pengeluar and `shortageMT / max(requiredMT, 1)` for Pengguna;
- `F = clamp(harmF / (2*|critPct|), 0, 1)` (forecast persistence);
- `C = 1` if supply `disahkan`, `0.5` if `lapuk`, `0` if `tiada` or `tidak-disahkan`.
Ties: level order, then larger `S`, then PO name. The score is not shown as probability; its tooltip lists the four components.

### B5.6 Mobilisation engine
Roles: Pengeluar anchor = SOURCE (selected PO has the surplus or falling farm price), candidates = DESTINATION. Pengguna anchor = DESTINATION (shortage or high retail price), candidates = SOURCE.

Eligibility (all must hold; the first failed rule is the recorded reason):
1. Candidate is not the anchor PO.
2. Same commodity and same unit (both `RM/kg`).
3. Stock available: Pengguna candidate `surplusMT > 0`; Pengeluar candidate `shortageMT > 0` (demand exists). Pengguna shortage in the anchor and Pengeluar surplus in the anchor are the engine's trigger and must be above zero, else the engine shows "PO terpilih tiada lebihan/kekurangan bekalan yang disahkan" and no lists.
4. Same zone (`zone` equal). Cross-zone is allowed only if a rule in `IV_CONFIG.crossZoneRules` (an array of `{from,to,approved:true,logisticsRef}`) matches. The default array is empty, so Semenanjung is never linked to Sabah or Sarawak, and Sabah to Sarawak is never linked (no cross-South China Sea).
5. Distance `<= distLimitKm`. Distance = haversine between the two PO coordinates times `detourFactor` 1.3, labelled "anggaran jarak jalan raya (dummy)".
6. Route feasibility, one rule with two sources and an explicit level mapping. `disruptionLevel(poId)` is the worst of:
   - `DATA.banjir` entries within 30 km of the PO, using their own `Amaran` / `Waspada` level;
   - AMS scenarios in `SCEN_LIST` (read at call time, B1) of `warningType==='amaran_banjir'` whose `affectedPOIds` include the PO and where `validFrom <= refNow <= validUntil`, mapped `riskLevel 'tinggi' -> Amaran`, `'sederhana' -> Waspada`, any other value -> ignored. Scenario types other than `amaran_banjir` (for example rain or heat) are shown as a flag only and never exclude.
   A candidate PO whose `disruptionLevel` is `Amaran` (as source or as destination) is excluded with the reason naming the source ("Amaran banjir AMS S03" or "Amaran banjir (DATA.banjir)"). Rule 6 applies to candidates only, never to the anchor. If the anchor's `disruptionLevel` is `Amaran` (at `refNow`: kelantan, the brief's Pasir Mas case, and sarawak through `DATA.banjir` Kuching), the engine still runs, Paparan 4 shows the banner "PO terpilih berada dalam amaran banjir. Sahkan akses laluan sebelum menghantar.", every candidate's `risiko penghantaran` list gains the line "Destinasi/sumber terjejas banjir" (destinasi in Pengguna, sumber in Pengeluar), and no extra score penalty is applied (the anchor's flood does not differ between candidates, so it cannot change their ranking). The banner is also part of the draft's `deliveryRisk` text. A `Waspada` anchor shows the same banner with "waspada" in place of "amaran" and no candidate line change. `Waspada` stays eligible with the chip "Waspada banjir" and a 5 point score penalty. Verified facts for `refNow` 2026-11-15T12:00+08:00: AMS `S03` is `amaran_banjir`, `riskLevel:'tinggi'`, `affectedPOIds:['kelantan','pahang']`, valid 14 Nov 10:00 to 15 Nov 18:00, so at `refNow` both Kota Baharu (`kelantan`) and Kuantan (`pahang`) are excluded (Kuantan only by `S03`, since `DATA.banjir` rates Kuantan `Waspada`). With `IV_TEST.setRefNow('2026-11-16T09:00+08:00')` `S03` has expired, so Kuantan becomes eligible with the "Waspada banjir" chip (from `DATA.banjir`) and Kota Baharu stays excluded (`DATA.banjir` `Amaran`, 5 km).
7. Cost estimate available: `costPerKg = costBase + costPerKm * km` with `costBase=0.03` RM/kg and `costPerKm=0.002` RM/kg per km (dummy, labelled "anggaran kos pengangkutan"). Total cost RM = `costPerKg * 1000 * qtyMT`.
8. Net gap positive: Pengguna `netGap = destPrice - srcPrice - costPerKg` with `destPrice = refPrice` (the anchor); Pengeluar `netGap = candDestPrice - srcPrice(refPrice) - costPerKg`. `netGap <= 0` is ineligible ("jurang harga bersih tidak positif").
Prices used: Borong price of the PO and commodity, mean over that PO's districts at the current period, with any overlay applied. This is a deliberate single stage so both modes compare like for like. Harga Ladang and Harga Runcit stay the alert indicators in Paparan 1 and 3 only.

Ranking (per list: Dalam Negeri and Luar Negeri separately; scores are not comparable between lists):
`priceScore = netGap / maxNetGap` (maxNetGap over that list's eligible set, `> 0` by rule 8);
`distScore = clamp(1 - km / distLimitKm, 0, 1)`;
`score = round(100 * (wP*priceScore + wD*distScore)) - floodPenalty` clamped at 0, where `wP = wPrice/100`, `wD = 1 - wP`. Transport cost is already inside `netGap`, so it is not counted twice. Sort by score, then `qty` desc, then `km` asc, then name. Take at most 5.
Deliverable quantity: `min(needMT, candidate surplusMT or shortageMT)`. If `availableVehicleCount` is known, also cap to `availableVehicleCount * (muatanMaxMT / kenderaanMax)`. Otherwise no vehicle cap and the card says "Ketersediaan kenderaan semasa tidak diketahui. Kapasiti maksimum statik: X MT". Max capacity is never used to assume availability.
Same logistics group: a candidate in the same `logisticsCapacityGroupId` as the anchor gets the chip "Kongsi kapasiti logistik (kumpulan gabungan)" and the transport risk line "Kapasiti kenderaan dikongsi dengan PO terpilih".
Same-state vs other-state is by `negeri` (so Dengkil and Selayang are in the same state; Johor Baharu and Simpang Renggam are in the same state).
Engine outputs `{ dalam:[…], luar:[…], excluded:[{poId,reason}], trigger:{…}, inputsEcho }`. It is a pure function (no DOM, no `Date.now`), so it is unit-testable.

### B5.7 District to PO, outlet assignment, zone eligibility (decisions)
- District to PO: only `IV_DISTRICT_MAP` (dummy-sah). No nearest-PO inference anywhere, including AI Muse.
- Outlet to PO: through the outlet's `districtId` and that map. Unmapped districts are `tidak-disahkan` and kept in the separate list.
- Zone: derived from the PO state as in B3.1; cross-zone default none.

### B5.8 Margin history and defaults
`IV_HISTORY` (dummy) is generated deterministically for each `(poId, commodityId)`: 12 weekly points `{ weekStart, beli, jual }`. `jual` follows the PO's mean Borong price from `DATA.rekod` with a seeded +-4 % variation; `beli = jual * (1 - spreadPct)` with `spreadPct` seeded 6 % to 12 %. Fixture with insufficient history: the real PO id for PO Perai is `penang` (`perai` is only a `logistikGroup` id), so the fixture is `penang` x `kubis-bulat` with an override of 4 points in `IV_HISTORY_OVERRIDE`. Defaults for the inputs: `jual`, `beli` = last history point (both editable), `ladang` = the mean over the PO's `Ladang` records for the commodity of `ivPrice().actual` (the last price, so any overlay applies; not `purata`), `kos` = per-PO dummy `IV_OPCOST` between 0.35 and 0.60 RM/kg, `target` = 15.
Pinned fixture for the brief's required margin test (Simpang Renggam, Cili Merah). The generator is bypassed for this pair by three override tables, so every expected number is fixed:
- `IV_HISTORY_OVERRIDE['simpangrenggam|cili-merah']`: 12 weekly points (weeks ending 2026-11-15 backwards), `beli` = 12.50 in all 12, `jual` = `beli + spread` with spread in order oldest to newest `[1.10,1.20,1.30,1.20,1.10,1.20,1.30,1.20,1.10,1.20,1.30,1.20]`. The last point is therefore `beli 12.50`, `jual 13.70`.
- `IV_OPCOST.simpangrenggam = 0.45` (RM/kg).
- `IV_MARGIN_DEFAULT_OVERRIDE['simpangrenggam|cili-merah'] = { ladang: 9.80 }` (replaces the `ivPrice()` mean for the default only; labelled "nilai lalai ujian (dummy)").
Expected at defaults (`target` 15, `S`=12.50, `F`=9.80, `C`=0.45, `J`=13.70): spread semasa 1.20; `Margin% = (12.50-9.80-0.45)/12.50*100 = 18.00`; `MaxFarmPrice = 12.50*0.85-0.45 = 10.175` (shown 10.18); `MinSell = (9.80+0.45)/0.85 = 12.0588` (shown 12.06); margin impact of the farm-price card = 15.00 - 18.00 = -3.00 percentage points; spread statistics mean 1.20, median 1.20, population sd 0.0707, slope 0.0042 so trend "stabil"; `mLow = 13.70-(1.20+0.0707) = 12.43`, `mHigh = 13.70-(1.20-0.0707) = 12.57`; recommended sell range `[max(12.06,12.43), 12.57] = [12.43, 12.57]`. Both cards are feasible at defaults (`farmLow` is the PO's `hargaLantai`, about 7, below 10.175; `MinSell` 12.06 is below `mHigh` 12.57). Assertions compare to 2 decimals (tolerance 0.005).
Statistics over `spread = jual - beli` of all history points: mean, median, population std dev, trend by least-squares slope (|slope| below 0.01 RM/week is "stabil"). Market-supported selling range for the PO: `mLow = max(0, J - (medianSpread + sd))`, `mHigh = max(0, J - max(0, medianSpread - sd))`, where `J` is the current Harga Borong Jual input. It is indicative, never called optimal.
Validation: all prices must be numbers with `0 < value <= 999`; `S <= 0` blocks margin computation ("Harga Borong Beli mesti lebih daripada 0"); `target` valid range is 0 to 95 inclusive. Any value above 95 and below 100 (for example 99) shows "Margin sasaran maksimum 95%", marks the field `aria-invalid` and keeps the last valid results. A value of 100 or more shows "Margin sasaran mesti kurang daripada 100%" with the same keep-last-valid behaviour. Negative values show "Margin sasaran tidak boleh negatif". No input ever produces a division by `1 - t <= 0`; empty or non-numeric input keeps the last valid results and marks the field `aria-invalid`.

### B5.9 AI Muse extraction and inclusion filter
Mock adapter `aiAdapter.extractMuseIssue(rawNote)` (deterministic): finds the commodity by an alias list (for example "kelapa", "kelapa matag" -> `kelapa-tua`; "cili merah" -> `cili-merah`), the location by exact match against `DATA.po[].districts` and `IV_GAZETTEER`, the event date by regex (`d MMMM [yyyy]` in Malay month names, `dd/mm/yyyy`, `yyyy-mm-dd`; the year defaults to the year of `recordDate`). With several dates in one note the rule is: (1) collect every date with its character offset; (2) discard recalled dates: a date is recalled if the 40 characters before it contain a recall cue (`tahun lepas`, `berbanding`, `sebelum ini`, `lalu`, `pada tahun`) or it is in a year earlier than the `recordDate` year; (3) among the remaining dates take the one whose offset is nearest to the commodity sentence (distance 0 when inside it); ties go to the earlier date; (4) if none remain and the note has an explicit event cue (`semalam`, `hari ini`, `kelmarin`, `baru-baru ini`), resolve that word against `recordDate`; (5) otherwise the insight has no `eventDate` and fails inclusion rule 3. M06 therefore discards "3 Mac 2025" (earlier year and recall cue) and, having no other date or cue, is excluded, the evidence as the sentence containing the commodity, the risk numbers from the raw record, and `locationType`: `disahkan` when the sentence says the event happened in that district ("di", "terjejas di"), `disebut` when the district appears only as context ("dilaporkan dari", "berbanding"), `belum` when no gazetteer match. `locationConfidence` is 0.9, 0.5, 0.
An insight is included in week W only if all hold: (1) a commodity was identified; (2) `locationType === 'disahkan'` with a district found in the gazetteer or district map; (3) `eventDate` exists and lies inside W (Monday to Sunday, compared as `YYYY-MM-DD` strings in Malaysia time, never the record date); (4) the issue concerns production, supply, price or marketing (keyword class check, not only sentiment); (5) it is not a duplicate: key `commodityId|districtId|eventDate|issueClass`, keeping the entry with the highest `locationConfidence` then the latest `recordDate`. `matchedPOId` is set only when the district is in `IV_DISTRICT_MAP`. Dungun is not, so the Kelapa Tua record never gets a PO.
Week maths: `weekStart(d) = d - ((dayOfWeek(d) + 6) % 7)` using `Date.UTC(y, m-1, d)` on the date parts of the ISO string. Prev/next move by 7 days. Next is disabled when `weekStart > weekStart(refNow)`; prev is disabled below the earliest `recordDate` in the dataset minus 14 days.
Stale: if `lastDataDate < refNow date - 1 day`, show a yellow banner "Data lapuk: kemas kini terakhir pada <tarikh>". The prototype `lastDataDate` is 2026-11-14, so it is fresh.

### B5.10 Filter semantics
| Filter | P1 map | P2 | P3 | P4/P5 | P6 |
|---|---|---|---|---|---|
| Komoditi | marker level, outlet "komoditi berkaitan" highlight | no | rows | sets `effCommodity` | commodity match |
| Negeri | PO markers shown | no | rows | no | state match |
| Pusat Operasi | = select PO (zoom) | yes | rows | anchor | PO match (if matched) |
| Daerah | district highlight | no | rows | no | district match |
| Tarikh / Tempoh Analisis 7/14/30 | baseline window | no | window | price window | no (has its own week) |
| Tahap Risiko | markers shown | no | rows | no | `riskBand` mapping: kritikal=merah, waspada=kuning, normal=hijau |
The toolbar control is labelled exactly as the brief words it, "Tarikh / Tempoh Analisis", with options "7 hari", "14 hari", "30 hari" (default 30) and the help line "Tempoh purata harga asas. Siri harga tiada tarikh." (below the label as small text). (assumption: the price series has no dates, so a date picker would have nothing to filter; the date dimension is covered by the week selector in Paparan 6). "No" cells show the chip "Penapis tidak terpakai" on the panel header when that filter is active. Cascades: Negeri options are the 13 distinct states; PO options are limited by Negeri; Daerah options come from the selected PO (or all districts of the selected Negeri's POs); choosing a Daerah with a unique mapped PO sets that PO; choosing "Semua" clears the lower levels.

## B6. State and cross-panel event flow

One reducer-like function, `ivDispatch(type, payload)`, validates input, updates `ivState`, then calls `ivRender(dirtyPanels)`. Panels re-render only if their signature (a `JSON.stringify` of the inputs they read) changed. Inputs the user is typing in are not re-created: Paparan 4 and 5 split into a static "kawalan" part (rendered once per PO/commodity change) and a "keputusan" part (re-rendered on every input event).

| Action | State changes | Re-rendered |
|---|---|---|
| `setMode` | `selectedMode`; clears `selectedInterventionId`, `selectedSourcePOId`, `selectedDestinationPOId`, `mob.candidateKey`, `selectedOutletId` | P1, P3, P4, P5 (hint), P6 chips |
| `setFilter(k,v)` | one filter with cascade (B5.10) | P1, P3, P4, P5, P6 per the table |
| `resetFilters` | defaults for filters, mode, selected* (keeps drafts, map zoom to Malaysia) | all |
| `selectPO(id)` | PO, state, clears district, outlet, intervention; sets role PO | P1 (+zoom), P2, P3 highlight, P4, P5 |
| `selectDistrict(id)` | district; sets PO if mapped | P1, P3 |
| `toggleOutletCat(c)` / `selectOutlet(id)` | `outletCats` / `selectedOutletId` | P1 only |
| `selectIntervention(id)` (Tindakan) | all selected* from the row, role PO set, `mob` reset | P1 (+fit to district), P2, P3 banner, P4, P5 |
| `setMob(k,v)` | `mob.*`, `wPrice` | P4 results only |
| `selectCandidate(key)` | `mob.candidateKey`, and `selectedSourcePOId`/`selectedDestinationPOId` | P4 detail |
| `createDraft` | pushes to `ivDrafts`, saves | P4 draft list, toast |
| `setMargin(k,v)` | `margin.*` | P5 results only |
| `museWeek(dir)` / `museExpand(id)` / `museEvidence(id)` | `muse.*` | P6 |
| `museTransfer(id)` | sets commodity, PO, state, district (when matched), clears intervention; role PO | P1, P2, P3, P4, P5 |
Role mapping: Pengeluar: `selectedSourcePOId = selectedPOId`, `selectedDestinationPOId = chosen candidate or null`. Pengguna: `selectedDestinationPOId = selectedPOId`, `selectedSourcePOId = chosen candidate or null`.
Event hygiene: rendering never dispatches. Async results carry a request token; a response whose token is older than the latest request is dropped (prevents out-of-order overwrite).

## B7. Mock AI adapter boundary

`aiAdapter` is one frozen object and the only place that produces AI-style prose. All methods are async and return `{ ok, text|data, model:'mock-deterministik-v1', generatedAt }`.
```js
aiAdapter.explainMobilisation(facts)  // facts = engine output summary (numbers already computed)
aiAdapter.explainMargin(facts)
aiAdapter.recommendPriority(facts)    // short banner text for Tindakan
aiAdapter.extractMuseIssue(rawNote)   // returns the structured fields of B3.8
aiAdapter.summariseMuse(insight)
```
Contract: inputs are plain JSON facts, not DOM and not state objects. Outputs are text or structured fields only. The UI never takes a number from adapter prose; every figure shown comes from the deterministic engines. Adapter text is rendered with `textContent` inside the distinct "Ringkasan AI (simulasi)" card. Response validation (`ivValidateAi`): `ok` must be true, `text` a string of 1 to 1200 characters; otherwise the UI shows the deterministic template sentence and the note "Penjelasan AI tidak tersedia, angka dikira oleh enjin." Timeout 4 s via `Promise.race`. Mock latency 200 to 400 ms to exercise the loading state (`aria-busy`). Future replacement: each method becomes a `fetch` to a backend (`POST /api/ai/mobilisation-explain`, `/margin-explain`, `/muse-extract`) with no key in the browser; the signature and the validation stay.
Test hook: `IV_TEST.failNext('ai'|'muse'|'map')` makes the next call reject so error states can be driven.

## B8. Data services and states

`ivDataService.loadMuse()` returns a Promise `{ status:'dummy', lastDataDate, processingStatus, records }`, resolved from the in-file `IV_MUSE_RAW`. It is the single swap point for a daily JSON file or endpoint (`fetch('/data/muse-weekly.json')` later). Schema check on load (`validateMuseRaw`): required `rawId, recordDate, analystNote` (strings, ISO date); invalid rows are dropped and counted (`dropped`), shown in "Status Pemprosesan: Sebahagian (N rekod tidak sah)". A rejection shows the panel error "Data AI Muse tidak dapat dimuatkan" with "Cuba Semula".
State matrix: Loading = skeleton and `aria-busy`; Error = message plus retry; Empty = specific message per panel (listed in each panel above); Stale = yellow banner (Muse data older than 1 day, supply `lastUpdated` older than 72 h shown as a "Lapuk" chip and used by B5.3).

## B9. Error handling and validation (concrete)

| Operation | Failure condition | Class | Caller sees | Log |
|---|---|---|---|---|
| Create map | `maplibregl` undefined or constructor throws | recoverable | list fallback (B4.2) | `console.warn('Peta intervensi tidak dapat dimulakan', err)` once |
| Basemap style | map `error` event or no `load` in 10 s | recoverable | banner "Peta asas tidak dapat dimuatkan" with retry; markers still work if the map exists | `console.warn` once (no spam) |
| Load Muse data | rejects or schema invalid | recoverable | panel error and retry; other panels unaffected | `console.warn` |
| AI adapter | reject, timeout, invalid shape | recoverable | template sentence and note, numbers intact | `console.warn` |
| localStorage read | `JSON.parse` throws or not an array | recoverable | starts with an empty draft list, no crash | none |
| localStorage write | quota or access denied | recoverable | draft kept in memory, toast "Draf disimpan sementara dalam sesi ini sahaja" | `console.warn` |
| Engine: missing supply or price row | no row | recoverable | that candidate excluded with reason "Data tidak lengkap"; if the anchor has none, panel empty state | none |
| Engine: division | denominators guarded (`max(x, 1e-9)`) | n/a | never NaN or Infinity | none |
| Unknown PO/commodity id in state (stale hash or hook) | not found | recoverable | state coerced to `null` and toast "Pilihan tidak sah, penapis diset semula" | `console.warn` |
| Unexpected exception in a panel render | any | contained | `try/catch` per panel render; that panel shows "Paparan ini tidak dapat dipaparkan. Cuba semula" and a retry button; others render | `console.error` (only here) |

Input validation:
| Input | Required | Type and limits | On failure |
|---|---|---|---|
| Filter selects | yes (has "Semua") | value must be in the option list | coerced to Semua |
| Tempoh | yes | 7, 14, 30 | coerced to 30 |
| `needMT` | yes | number, 0.1 to 500 | field flagged, last valid kept, message "Masukkan 0.1 hingga 500 MT" |
| `refPrice` | yes | number, 0.01 to 999 | same pattern, "Masukkan harga RM/kg antara 0.01 dan 999" |
| `wPrice` | yes | integer 0 to 100, step 5 | clamped |
| `distLimitKm` | yes | number 50 to 2000 | flagged, last valid kept |
| Margin prices | yes | number 0 < v <= 999 | flagged, last valid kept |
| `kos` | yes | number 0 to 999 | flagged |
| `target` | yes | number 0 to 95 | 95 < v < 100: "Margin sasaran maksimum 95%"; v >= 100: "Margin sasaran mesti kurang daripada 100%"; v < 0: "Margin sasaran tidak boleh negatif"; all keep the last valid result |
| Threshold settings | optional | per B5.1 | flagged, not applied |
| Muse week | internal | ISO Monday | coerced to the current week |
| localStorage draft payload | n/a | each stored record validated (`status==='draf'`, ids strings, numbers finite) | invalid entries dropped |

Invariant ownership (who enforces what):
- Weights total 100: enforced by construction in `ivState` (`wDist` derived). The UI cannot hold a different total.
- Only `draf` can be created: enforced in `createDraft` (the sole writer of drafts), not by the UI.
- Critical needs supply confirmation: enforced in `ivClassify()` (engine layer). Rendering and map code consume the level and never recompute it.
- Cross-zone exclusion: enforced in the mobilisation engine's eligibility; the UI only displays.
- Dummy versus real separation: enforced at the data layer by `source` on every record; renderers must call `ivBadge(record)`; the verification script asserts that every panel has at least one badge.
- Non-negative prices in recommendations: enforced in the margin function (`safe()` wrapper), not by input limits alone.
- HTML safety: all dynamic text through `textContent` or `esc()`.

## B10. Responsive plan
Breakpoints reuse the app's: 1250, 800 and 540 px.
- At 1250 px and wider: `.iv-grid-top{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-areas:"map log" "map pri"}`; map height 600 px; Paparan 4 two columns; filters in one wrapped row.
- 800 to 1249 px: single column, order map, logistik, priority; map 460 px; Paparan 4 columns stay side by side down to 900 px, then stack.
- Below 800 px: all panels stacked; map 360 px; filter toolbar a two-column grid; outlet chips scroll horizontally; priority rows become cards (fields wrap in 2 columns, "Tindakan" full width); mobilisation columns stack; tables become cards (no horizontal page scroll; any wide table is inside `overflow:auto`).
- Below 540 px: map 300 px; in-map tabs keep a 40 px touch height at full width of the overlay; filter toolbar collapses into a `Penapis` toggle button (the same controls, shown or hidden), and "Set Semula" stays visible.
Touch targets at least 40 px; font sizes at least 12 px; popups limited to `max-width: calc(100vw - 40px)`.

## B11. Dummy scenarios (concrete seeds; all `dummy`)
Overlays (`IV_PRICE_OVERLAY`) and supply overrides (`IV_SUPPLY_OVERRIDE`, values in MT) to make the required tests deterministic:

| # | Mode | PO, district, commodity | Price overlay | Supply (available, reserved, required) | Result |
|---|---|---|---|---|---|
| T1 | Pengeluar | simpangrenggam, Kluang, Cili Merah (Ladang) | dev -17.5 %, forecast -19 % (district Kluang only; PO level = worst district) | 18, 1, 5 (surplus 12), fresh | Kritikal. Anchor (sumber) for the T1 mobilisation test |
| T1b | Pengeluar destinations | `IV_SUPPLY_OVERRIDE` Cili Merah (available, reserved, required): johor 2/0/8 (shortage 6), selangor 2/0/7 (shortage 5), perak 3/0/7 (shortage 4), sabah 2/0/8 (shortage 6) | `IV_PRICE_OVERLAY` Borong Cili Merah: perak, all 4 districts (Kinta, Kampar, Kuala Kangsar, Manjung), dev +6 %, forecast +6 % | Without the overlay only johor (gap +1.18) and selangor (+0.62) have a positive net gap from simpangrenggam; the perak overlay (about 15.4 RM/kg) adds a second other-state destination (gap about +0.7 at 504 km) |
| T1c | Pengeluar expected | anchor simpangrenggam, `distLimitKm` 550, default weights | n/a | n/a | **Dalam Negeri eligible: [johor]. Luar Negeri eligible: [selangor, perak]** (order by score). Not eligible: melaka, negerisembilan, selayang, pahang (they have surplus, rule 3); kelantan (640 km, rule 5); sabah and sarawak (rule 4 zone, sabah has shortage so it is excluded by zone); the others fail rules 3, 5 or 8 |
| T2 | Pengguna | johor, Johor Bahru, Cili Merah (Runcit) | dev +16 %, forecast +18 % (district Johor Bahru only) | 2, 0, 8 (shortage 6, coverage 0.25) | Kritikal. Anchor (destinasi) for the T2 mobilisation test; `refPrice` default = johor Borong mean 15.00 |
| T2s | Pengguna sources | `IV_SUPPLY_OVERRIDE` Cili Merah surplus: simpangrenggam 18/1/5 (surplus 12), melaka 16/0/6 (10), negerisembilan 11/0/6 (5), selayang 12/0/6 (6), pahang 14/0/6 (8), kelantan 15/0/6 (9), sarawak 14/0/6 (8). selangor, perak and sabah keep their T1b shortage rows | none (no Borong overlay on these sources besides perak from T1b) | as stated | **Expected at `distLimitKm` 550: Dalam Negeri eligible [simpangrenggam]; Luar Negeri eligible [melaka (gap +0.92, 240 km), negerisembilan (+0.62, 317 km), selayang (+0.62, 398 km)]. Excluded: pahang (AMS S03 flood Amaran at `refNow`), kelantan (706 km, rule 5; with `distLimitKm` 800 it fails rule 6 on S03 / `DATA.banjir`), perak and selangor (shortage, rule 3), sabah and sarawak (rule 3 for sabah; rule 4 zone for sarawak).** Gaps computed from the real last Borong prices with `costBase` 0.03 and `costPerKm` 0.002 and detour 1.3 |
| T3 | Pengguna | kelantan, Pasir Mas, Bawang Merah Kecil (Runcit) | dev +17 %, forecast +19 % | 3, 0, 9 (shortage 6) | Kritikal. The anchor is under flood Amaran at `refNow` (B5.6 rule 6), so Paparan 4 shows the anchor-flood banner. Source-side `IV_SUPPLY_OVERRIDE` rows for Bawang Merah Kecil (available, reserved, required): perak 14/0/6 (surplus 8), pahang 12/0/6 (6), terengganu 13/0/6 (7), johor 9/0/6 (3). The candidate lists are not pinned to exact ids (distances and Borong prices decide), so T3 asserts structure only (B13 step 7c) |
| T4 | Pengeluar | perlis, Kangar, Cili Merah (Ladang) | dev -16 % | 6, 0, 5.5 (surplus 0.5, below minimum) | Waspada, "Menunggu pengesahan bekalan" |
| T5 | Pengeluar | sarawak, Serian, Kubis Bulat (Ladang) | dev -18 % | surplus 9 but `lastUpdated` 5 days old | Waspada, "Data stok lapuk" |
| T6 | Pengeluar | pahang, Temerloh, Cili Hijau; sabah, Tuaran, Tomato Bulat | -10 %, -9 % | surplus 6, 5 | Waspada |
| T7 | Pengguna | pahang, Kuantan, Tomato Bulat (Runcit) | +18 % | coverage 1.2 (no shortage) | Waspada (price only, no confirmation) |
| T8 | Pengguna | selangor, Sepang, Cili Hijau; sarawak, Kuching, Ayam Proses Super | +9 %, +10 % | coverage 0.7; stale stock | Waspada |
Disruption (at `refNow` 2026-11-15T12:00+08:00): Kota Baharu (`kelantan`: AMS `S03` `tinggi` = Amaran, plus `DATA.banjir` Amaran, 5 km), Kuantan (`pahang`: AMS `S03` `tinggi` = Amaran; `DATA.banjir` alone would be Waspada) and Samarahan (`DATA.banjir` Kuching Amaran, about 27 km) are excluded as candidates. After `IV_TEST.setRefNow('2026-11-16T09:00+08:00')` S03 has expired: Kuantan becomes eligible with the chip "Waspada banjir" (when its other rules pass, for example as a T2 source) and Kota Baharu and Samarahan stay excluded. Row `normal + disahkan` check (B5.4): any PO and commodity with confirmed supply and a normal price must stay `normal` with only the "Isyarat bekalan awal" chip (asserted with the pure function: `ivClassify` on a fixture with `devPct` 0 and surplus 10 returns `normal` plus the chip flag).
Test 4 fallbacks: outlet-less district (Jasin, Jelebu); unmapped PO via `IV_TEST.withholdDistrictMap('penang')` (sets `mappingStatus:'tidak-disahkan'` for all districts of that PO at runtime, to exercise the banner); no eligible supplier (anchor `sabah` in Pengguna with Cili Merah: sabah has shortage 6 and is the only PO of zone Sabah, so both lists are empty with the two empty-state texts; a Sarawak anchor has surplus and shows "PO terpilih tiada lebihan/kekurangan bekalan yang disahkan"); insufficient history (`penang` x `kubis-bulat`, 4 weeks, `IV_HISTORY_OVERRIDE`); no weekly issues (week 26 Oct to 1 Nov); unknown logistics availability (every PO except the three dummy rows).

AI Muse raw set (`IV_MUSE_RAW`, 9 notes, dummy; week W0 = 9 to 15 Nov 2026):
1. `M01` Kelapa Tua (Matag), Dungun, Terengganu. Note written on 11 Nov about the event on 4 Nov (69 pekebun terjejas, tekanan harga akibat kelapa import). Risk before 4, current 16, change +12, band Hijau (below 20). It is outside W0, so it appears only in the week 2 to 8 Nov. District unmapped, so no PO and no transfer button. This also meets the brief rule that the reference example must not show in the current week.
2. `M02` Cili Merah, Kluang, Johor: event 12 Nov, harga ladang jatuh, lebihan. Mapped (simpangrenggam). Included. Transfer button available.
3. `M03` Bawang Merah Kecil, Pasir Mas, Kelantan: event 13 Nov, kenaikan harga runcit, bekalan terhad. Mapped (kelantan). Included.
4. `M04` Tomato Bulat, Cameron Highlands, Pahang: event 10 Nov, cuaca menjejaskan hasil. District only in the gazetteer, no PO. Included, no transfer.
5. `M05` Cili Merah, Kluang: same event 12 Nov, second analyst note. Duplicate by key. Excluded.
6. `M06` Kubis Bulat: note on 12 Nov that recalls "pada 3 Mac 2025 harga jatuh". Event date 2025-03-03. Excluded (event outside week).
7. `M07` Ayam Proses Super: "dilaporkan di sebuah pasar di utara" with no district. `locationType` belum. Excluded.
8. `M08` Telur Gred A: note about a staff training. No commodity issue class. Excluded.
9. `M09` Cili Hijau, Temerloh: event 5 Nov (week 2 to 8 Nov). Gives the previous week a second record.
Counts expected: W0 shows 3 issues, 3 locations, 3 commodities; week 2 to 8 Nov shows 2 issues (M01, M09); week 26 Oct to 1 Nov shows 0 and the exact empty text.

## B12. Testability
Pure, unit-testable through `IV_TEST` (run in the page via `page.evaluate`, no DOM needed): `ivClassify`, `supplyConfirm`, `priorityScore`, `mobilisationEngine`, margin functions (`marginPct`, `maxFarmPrice`, `minSell`, `historyStats`), `weekStart`/`weekRange`, `extractMuseIssue`, `museInclude`, `validateMuseRaw`, `ivValidateAi`. Needs DOM or a browser: tab switching, map markers, popups, fitBounds, slider linkage, localStorage persistence, responsive layout, console errors. The map is verified through DOM markers and `map.getCenter()/getZoom()`, with the map instance exposed as `IV_TEST.map()`.
`IV_TEST` exports: `state` (returns a deep clone), `outletStats`, `dispatch`, `refresh()` (re-read scenarios and re-render), `setScenariosPending(bool)`, the pure functions above, `map()`, `drafts()`, `failNext(kind)`, `withholdDistrictMap(poId)`, `setRefNow(iso)`.

## B13. Runtime verification plan
Reuse `.agents/tasks/bt` (puppeteer-core with Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, flags `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, already installed). New files, all named `intervensi-*` under `.agents/tasks/`: `intervensi-test.js` (run from `.agents/tasks/bt` with `node ../intervensi-test.js`, requiring `./bt/node_modules`), `intervensi-test-output.txt`, `intervensi-shots/*.png`, `intervensi-verification.md`.
Steps (each prints PASS/FAIL, console errors/warnings and `pageerror` are collected for the whole run):
1. Baseline: open the original backup file once and record its console messages. The new file must add no message that is not in that baseline (the unpkg and CARTO network warnings are tolerated only if they are in the baseline).
2. Load the file. Assert the old tab is visible and `#map .po-marker` count is 15. Screenshot.
3. Open the tab (click and via `#intervensi`). Assert the new view visible, old hidden, `#ivMap` canvas exists, 15 `.po-marker` in `#ivMap`, default mode PENGELUAR. Switch back and verify old map still responds (`DASHBOARD_TEST.selectPO('johor')`, then click `#backMap` / `#resetFilters` (there is no `DASHBOARD_TEST.reset`)).
4. Mode switch: marker colour counts change; priority list differs; rows sorted by score (assert non-increasing); T4 shows no red. Switch back.
5. Click every one of the 15 PO markers: zoom changes (`getZoom` greater than before), district polygons appear (when mapped), panels P2 to P5 show that PO's name; Kota Kinabalu shows 6 / 16.31 / 6 / 59.90; Dengkil, Selayang, Johor Baharu, Simpang Renggam show the group note. Outlet chips toggle counts; the legend is present; outlet popup fields present; Jasin and Jelebu show the empty text; `withholdDistrictMap('penang')` shows the banner.
6. Tindakan on the first row and on a yellow row: panels P4 and P5 update, banner appears, the tab does not change.
7. Mobilisation: T1 (simpangrenggam, Cili Merah, Pengeluar) and T2 (johor, Cili Merah, Pengguna). Move each slider and assert `wPrice + wDist === 100`. Assert the expected sets from B11 exactly: T1 Dalam [johor], Luar [selangor, perak]; T2 Dalam [simpangrenggam], Luar [melaka, negerisembilan, selayang]; each list at most 5; no sabah or sarawak candidate when the anchor is Semenanjung; kelantan (flood) and pahang (S03 flood at `refNow`) absent from T2 with the exclusion reasons listed under "ditapis keluar". Then `IV_TEST.setRefNow('2026-11-16T09:00+08:00')` and assert pahang is no longer excluded for flood but carries the "Waspada banjir" chip, and kelantan stays excluded. Candidate click opens the detail card; "Sediakan Cadangan Intervensi" creates a draft, `localStorage['fama-iv-draf-v1']` contains it with status `draf`; reload and the draft is still listed; a repeated click does not duplicate. Anchor `sabah` in Pengguna (Cili Merah) gives both empty states.
8. Margin: defaults for Simpang Renggam Cili Merah equal the pinned fixture of B5.8 (`beli` 12.50, `jual` 13.70, `ladang` 9.80, `kos` 0.45, target 15): assert Margin% 18.00, MaxFarmPrice 10.18 (10.175), MinSell 12.06, margin impact -3.00 pp, spread mean/median 1.20, sd 0.07, trend "stabil", recommended sell range 12.43 to 12.57, and that both cards are feasible; type new numbers (assert instant recompute); set target 99 ("Margin sasaran maksimum 95%", last results kept), 95.5 (same message) and 100 ("Margin sasaran mesti kurang daripada 100%"), target 95 with a high farm price (infeasible text exactly), `S=0` (no NaN); `penang` (PO Perai) Kubis Bulat shows the insufficient-history warning; both definitions are present verbatim.
9. AI Muse: current week shows 3 cards and counts 3/3/3; Kelapa Tua absent; click prev week and it appears with no transfer button; prev again shows the exact empty text; next returns; expand a card, toggle evidence twice (hidden, visible, hidden); on M02 the transfer button sets PO simpangrenggam and commodity Cili Merah and updates P3 and P4.
10. Failure injection: `failNext('muse')` shows the error and retry works; `failNext('ai')` shows the template fallback; block the style URL (request interception) to see the map fallback list.
11. Reset: change filters and mode, click Set Semula, assert defaults and map view at Malaysia bounds, drafts kept.
12. Responsive: at 1440x900, 1024x768 and 390x844 take full-page screenshots of the new tab and the old tab; assert `document.documentElement.scrollWidth <= innerWidth`, the map frame height matches B10, and all tap targets are at least 40 px for the in-map tabs.
13. Old tab regression: for each original control (`#filterCommodity`, `#filterState`, `#resetFilters`, `#floodToggle`, `#showLogs`, AMS scenario click) assert behaviour is as in the baseline run.
14. Final: print the console error list; the run fails if any new error or warning appeared.
Step 3b (deep link regression, finding 9): load `...html#intervensi` fresh (new page), wait for `load` and `famaScenariosReady`, assert the new view is visible, then click the old tab and assert the old map canvas has width and height above 0, `getZoom()` is finite, `getCenter()` is finite, and no console message that the baseline run did not have.
Step 7b (scenario timing, finding 1): load with `#intervensi`, wait for settle, assert the T2 Luar list does not contain pahang; separately call `DASHBOARD_TEST.setScenarios([])` then `IV_TEST.refresh()` and assert pahang now appears (eligible, flagged "Waspada banjir" from `DATA.banjir`), then restore with `DASHBOARD_TEST.initScenarios()` and `IV_TEST.refresh()`. Also assert the first render before settle shows the chip "Amaran cuaca/banjir AMS sedang dimuatkan" (throttle by delaying the scenario loader is not required: assert the chip text exists in the source and is shown when `IV_TEST.setScenariosPending(true)`).
Step 3c (isolation): (i) assert `typeof IV_TEST==='object'`; compute `baselineKeys` from the backup file loaded in step 1, then `const added = Object.keys(window).filter(k => !baselineKeys.includes(k)).sort(); assert.deepEqual(added, ['FAMA_MAP_CONFIG','IV_TEST','famaMonitorMapResize','famaScenariosReady'])` (E5, E7, E7b and the IIFE; nothing else leaks); (ii) assert `document.querySelectorAll('#viewIntervensi [data-district],#viewIntervensi [data-risk],#viewIntervensi [data-open-action],#viewIntervensi [data-record],#viewIntervensi .map-panel,#viewIntervensi .price-row,#viewIntervensi .risk-item').length === 0`; (iii) snapshot `JSON.stringify(IV_TEST.state())` (clone), call `DASHBOARD_TEST.renderAll()` (and click an old `#filterState` option and `#resetFilters`), and assert the new snapshot is identical, so the old global handlers cannot reach `ivState`; (iv) the old tab console baseline is unchanged.
Step 5b (logistics readiness): assert the chip for PO Kota Kinabalu is grey "Kesiapsiagaan tidak dapat dinilai", PO Johor Baharu and PO Simpang Renggam both show 5 / 62.0 / 92.4 and "Terhad", PO Ayer Keroh shows "Sedia" and PO Kota Baharu shows "Kritikal" (B3.6 values), and Dengkil and Selayang both show the null message.
Step 5c (selected PO outside filter): select PO Kota Baharu, set Negeri to Johor, assert the Kota Baharu marker still exists with the dashed-ring class and the chip "Terpilih (di luar penapis)", panels P2 to P5 still show Kota Baharu, then Set Semula removes the chip. Also assert `IV_TEST.outletStats()` satisfies B3.3 (each category at least 3 outlets, every PO at least 1, empty only for Jasin and Jelebu) and that the nine named outlets (Kluang, Johor Bahru, Pasir Mas) exist.
Step 6b (jenis isu): assert every Paparan 3 row label is one of the four base labels, with the optional supply suffix only when `supplyConfirm` is `disahkan`; T1 Kluang row reads "Harga ladang jatuh + lebihan bekalan disahkan" with Kritikal; T4 Kangar row reads "Harga ladang jatuh" with no suffix.
Step 7c (anchor under flood): at `refNow`, trigger "Tindakan" on the T3 row (kelantan, Pasir Mas, Bawang Merah Kecil) in Pengguna. Assert Paparan 4 renders with no error state, shows the banner "PO terpilih berada dalam amaran banjir. Sahkan akses laluan sebelum menghantar.", no candidate in either list is `kelantan`, and every rendered candidate's detail lists the line "Destinasi/sumber terjejas banjir". Repeat for the Samarahan case (anchor `sarawak`, Pengeluar, Kubis Bulat) to confirm the banner appears and no exception is thrown.
Also run `node --check` on the extracted `ivScript` body (extract with a regex in the test) as the only available lint, since the repo has no build, lint or test scripts (verified: only `.agents` and the HTML at the repo root).

---

# Part C. Notes for review (decisions that could be challenged)
1. Tab bar is added because none exists; the old page is wrapped in `#viewMonitor` rather than re-parented.
2. Second map instance with the shared style/bounds instead of a shared canvas (B1).
3. The existing `rekod.status` is not used for alerts because it ignores direction and disagrees with the stored series (B3.4). Overlays create the required test scenarios and are badged.
4. Only PO names, approximate coordinates and logistics maximums are marked `sebenar`.
5. Reference Muse example moved outside the current week to follow the brief; the PPT screenshot shows it inside 9 to 15 Nov, which conflicts. Changing `M01`'s event date to 2026-11-11 reverses this with no code change.
6. Risk-band cut-offs for AI Muse (below 20 hijau, 20 to 39 kuning, 40 and above merah) are chosen to match the reference card (current 16 = Hijau) and are configurable.
7. Mobilisation compares Borong prices in both modes.
8. Draft interventions are separate from the existing "Rekod Tindakan" log and its storage key.

---

# Part D. Responses to the design review (revision 2)

| # | Severity | Decision | Where |
|---|---|---|---|
| 1 | HIGH | Addressed. AMS `riskLevel` maps `tinggi` to Amaran and `sederhana` to Waspada; AMS counts for exclusion only for `amaran_banjir`. At `refNow` S03 excludes both Kuantan and Kota Baharu; Kuantan is eligible with a "Waspada banjir" chip only after S03 expires (`setRefNow` 2026-11-16). Scenarios are read at call time, refreshed when `famaScenariosReady` settles (new one-line export E7b), on every tab show and by `IV_TEST.refresh()`; a pending chip is shown meanwhile. B11 and B13 now agree. | B1, B5.6 rule 6, B11, B13 steps 7, 7b |
| 2 | MEDIUM | Addressed. `normal + disahkan` stays `normal` with an informational chip only; it does not affect colour, counts, filter or P3 rows. | B5.4, B3.5, B11 |
| 3 | MEDIUM | Addressed. Forecast uses `|warnPct|` everywhere; B3.4 states it is the same threshold. | B3.4, B5.2 |
| 4 | MEDIUM | Addressed. Overlay districts are stated; explicit shortage overrides for johor, selangor, perak, sabah; a perak Borong overlay gives a second other-state destination; expected eligible and excluded PO ids for T1 and T2 are listed (computed from the real Borong prices with the stated cost formula), and B13 asserts them exactly. | B11, B13 step 7 |
| 5 | MEDIUM | Addressed. `perai` replaced by `penang` in fixtures and tests. | B5.8, B11, B13 |
| 6 | MEDIUM | Addressed. `ivScript` is a strict-mode IIFE exposing only `IV_TEST`; B13 step 3c checks no extra globals. | B1 E8, B13 |
| 7 | MEDIUM | Addressed. Recall-cue discard, nearest-to-commodity-sentence choice, relative-word fallback, otherwise excluded. | B5.9 |
| 8 | MEDIUM | Addressed. 0 to 95 valid; 95 < v < 100 shows "Margin sasaran maksimum 95%"; >= 100 keeps its own message; negatives handled; last valid results kept. | B5.8, B9, B13 step 8 |
| 9 | MEDIUM | Addressed. Hash applied only after `load` and scenario settle plus one frame; regression step 3b added. | B1, B13 |
| 10 | NIT | Fixed: 50 districts. | B3.2 |
| 11 | NIT | Fixed: `max(suffix)+1`. | B3.7 |
| 12 | NIT | Fixed: `focus({preventScroll:true})`. | B4.4 |
| 13 | NIT | Fixed: use `#backMap` / `#resetFilters` (both exist in the HTML). | B13 step 3 |
| 14 | NIT | Fixed: permanent note in the map panel. | B3.3 |
| 15 | NIT | Fixed: control labelled "Tempoh asas (hari)" with a help line; the brief's date dimension is covered by the Paparan 6 week selector. | B5.10 |

(Row 15 above is superseded by finding 7 of revision 3: the control is now labelled "Tarikh / Tempoh Analisis".)

---

# Part E. Responses to the design review (revision 3)

| # | Severity | Decision | Where |
|---|---|---|---|
| 1 | MEDIUM | Addressed. Forbidden attributes and classes listed for `#viewIntervensi`; all hooks use `data-iv-*`. B13 step 3c asserts none exist and that `DASHBOARD_TEST.renderAll()`, an old filter click and `#resetFilters` leave `ivState` unchanged. | B1, B13 3c |
| 2 | MEDIUM | Addressed. Step 3c now asserts the added window keys equal exactly `FAMA_MAP_CONFIG, IV_TEST, famaMonitorMapResize, famaScenariosReady`; the E8 sentence is corrected. | B1 E8, B13 3c |
| 3 | MEDIUM | Addressed. Rule 6 applies to candidates only. A flooded anchor runs the engine, shows a banner, adds a risk line to every candidate, no score penalty. Step 7c covers T3 and the Samarahan case. | B5.6 rule 6, B11 T3, B13 7c |
| 4 | MEDIUM | Addressed. Pinned `IV_HISTORY_OVERRIDE`, `IV_OPCOST` and `IV_MARGIN_DEFAULT_OVERRIDE` for simpangrenggam x cili-merah, with expected values (MaxFarmPrice 10.175, MinSell 12.06, Margin 18.00, range 12.43 to 12.57) asserted in step 8. The farm price default of 9.80 is an added pinned input, since the generator value is not stated. | B5.8, B13 8 |
| 5 | MEDIUM | Addressed. `availableCapacityMT` is free storage space compared with `simpananMaxMT` only; `IV_LOGISTICS_AVAIL` is keyed by `logisticsCapacityGroupId` with explicit values that satisfy actual + free = max (using the real maximums from `DATA`); readiness verdicts Terhad, Sedia, Kritikal asserted in step 5b. | B3.6, B4.3, B13 5b |
| 6 | MEDIUM | Addressed. One label rule: price-level label by mode, forecast-only label, optional supply-confirmed suffix; no stand-alone supply labels. Step 6b asserts it. | B4.4, B13 6b |
| 7 | NIT | Addressed. Label "Tarikh / Tempoh Analisis" with 7/14/30 hari and the help line. | FR-2, B2, B5.10 |
| 8 | NIT | Addressed. `replaceState` wrapped in try/catch with `location.hash` fallback. | B1 |
| 9 | NIT | Addressed. Per-category and per-PO minimums, nine named outlets for Kluang, Johor Bahru and Pasir Mas, `IV_TEST.outletStats()` and a test. | B3.3, B13 5c |
| 10 | NIT | Addressed by pinning the T3 source-side supply rows and stating that T3 asserts structure only (distances and prices decide the candidate ids). | B11 T3, B13 7c |
| 11 | NIT | Addressed. Selected PO stays visible with a dashed ring and the chip "Terpilih (di luar penapis)"; step 5c. | B4.2, B13 5c |
| 12 | NIT | Addressed. B3.1 states that names come from `DATA.po[].name` unchanged. | B3.1 |
| 13 | NIT | Addressed. Default = mean over the PO's Ladang records of `ivPrice().actual`. | B5.8 |

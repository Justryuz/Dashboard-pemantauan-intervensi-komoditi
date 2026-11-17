# Implementation Plan: AI Multi-Scenario Monitoring panel

Decision: this is one coherent panel in one file, so there is no FEAT decomposition. The existing implement-and-review loop runs this plan.

Target file: `c:\Users\User\Documents\2026\intervensi bencana\Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html` (208 lines, UTF-8, vanilla HTML/CSS/JS, MapLibre GL 4.7.1).
Backup of the original: `.agents/tasks/original-before-ai-panel.html`.
Gate file for the loop: `.agents/tasks/ams-review.json` with `{"verdict":"APPROVED"|"CHANGES_REQUESTED",findings,reviewDoc}`.

## Hazards

- Line 109 is the huge `const DATA = {...}` line. Never print, reformat or edit it. Use `grep_search`, and `read_file` with offset/limit only on other lines.
- Line 10 (`:root{...}`) and several other CSS lines are very long. Do not rewrite them. Add new CSS only as a new `<style>` block.
- The file is UTF-8 with Malay text and symbols. PowerShell `Get-Content` without `-Encoding UTF8` shows mojibake. Edit with `str_replace` or `fs_write`, never with PowerShell `Set-Content` round trips. Afterwards confirm `git diff`-style integrity: `original-before-ai-panel.html` vs the new file differ only by the planned insertions.
- Use unique anchors for `str_replace`. Lines 203 and 204 are very long, so match a short unique substring.
- Not a git repo, so there is no commit. Keep the backup as the rollback.

## Verified anchors (current line numbers)

| What | Line | Anchor |
|---|---|---|
| Main `<style>` | 9 to 58 | `</style>` at 58, then `</head>` at 59 |
| Tokens | 11 | `:root{--bg:#061126;--panel:#0b1a37;--panel2:#0d2244;--panel3:#112b52;--line:#1b3865;--line2:#234977;--white;--muted;--cyan;--blue;--green;--yellow;--red}` |
| Responsive breakpoints | 12 to 14 | 1250px, 800px, 540px |
| Reduced motion | 26 | already a global `prefers-reduced-motion` rule |
| `.bottom-grid` | 15 to 25 | `margin-top:28px`, bordered gradient box |
| `.triple-row` (4 panels under map) | 86 to 91 | closes with `</div>` at 91 and 92, then `</aside>`... see below |
| `</main>` | 100 | |
| `<section class="bottom-grid">` | 101 | open |
| `</section>` closing bottom-grid | 104 | followed by `<footer class="footer">` at 105 |
| `modalMount` and `toast` | 107 | `<div id="modalMount"></div><div id="toast" ...>` |
| `<script>` | 108 | |
| `const DATA` | 109 | do not touch |
| `const state={...}` | 111 | `po,daerah,komoditi,indikator,issues,days,banjir,chartRecord,lowStage,highStage` |
| `labels`, `weight` | 112, 113 | status labels and weights |
| `actions` (localStorage `fama-demo-intervensi-v1`) | 114 | |
| `poById` | 115 | |
| `esc`, `money`, `fmt` | 116 to 118 | |
| `statusHTML`, `poStatus(p,district)`, `toast` | 119, 121, 123 | |
| `initControls()` | 124 to 129 | `#filterState` change handler at 127, `#resetFilters` at 128, `#backMap` at 129 |
| `selectPO(id)` | 148 | sets `state.po`, `$('filterState').value=id`, `zoomTo`, `renderAll`, scrolls to `.map-panel` |
| Map IIFE | 150 to ~200 | `initMap` 152, `addMapMarker` 155, `mapEl` 156, `mapChild` 157, `renderMap` 158, `zoomTo` 172 (local to this scope) |
| PO marker creation | 163 | `mapEl(\`po-marker status-${s}${state.po?' compact':''}\`, ...)` inside `visible.forEach(p=>{...})` |
| `renderQueue` | 202 | |
| `renderAll()` | 203 | `function renderAll(){renderLogistik();renderKpis();renderMap();...renderQueue();const selected=...` |
| `openActionModal(recordId)` | 204 | textarea `id="actionNote"` with a `placeholder`, save button `id="saveAction"` |
| `initControls();renderAll();` | 208 | |
| `window.DASHBOARD_TEST=...` | 209 | `{state,DATA,selectPO,selectDistrict,renderAll,filteredRecords,poStatus}` |
| `</script>` | 210 | |

(Line numbers include the long lines. Re-grep before editing, because earlier edits shift them.)

The map code is inside a closure (`renderMap`, `zoomTo`, `map`, `mapMarkers`). Read lines 150 to 201 with offset/limit first to find the closure's end and to see where `map` and `mapView` are declared. The new `fitScenarioPOs()` helper must be added inside that closure and exposed (see step 7).

## State fields

Add at the new JS block, not inside the `state` literal at line 111 (avoid editing it). Run `Object.assign(state,{scenario:null,scenarioPO:null,scenarioLoad:'loading'})` in the new block. `state` is already a global `const` object, so adding properties is safe.

- `state.scenario`: selected scenarioId or null.
- `state.scenarioPO`: selected PO id in the drawer or null.
- `state.scenarioLoad`: `'loading' | 'ready' | 'error' | 'empty'`.
- Module variable `SCEN_LIST`: array of validated scenarios (loaded via `ScenarioService`).

Do not reset these in `#resetFilters` (line 128). Reset only clears filters. Selecting a scenario does not change `state.po` unless the user presses "Lihat harga komoditi PO ini".

## Steps

- [ ] 1. Add a new `<style id="amsStyle">` block after line 58 (`</style>`), before `</head>`. Namespace everything `.ams-*`, plus `.po-marker.scenario-ring`.
      Use existing tokens (`--panel`, `--panel2`, `--panel3`, `--line`, `--line2`, `--white`, `--muted`, `--red`, `--yellow`, `--cyan`). Orange is `--yellow`-adjacent: add a local `--ams-orange:#ff9f43` on `.ams-panel`.
      Styles needed: `.ams-panel` (full width, `margin-top:28px`, no change to `.bottom-grid`), `.ams-head` (flex, title + `DATA DUMMY` badge using existing `.tag`), `.ams-kpis` (3 columns, stays 3 columns down to 390 px with smaller font), `.ams-card` (button reset, rounded 14px, 1px `--line` border, `--panel2` bg, transition on border, background, transform), `.ams-card:hover`, `.ams-card:focus-visible` (2px cyan outline), `.ams-card.sel` (brighter `--panel3` bg and coloured border), `.ams-risk-sederhana` (orange), `.ams-risk-tinggi` (red), `.ams-chev` (rotates 90 degrees when `aria-expanded=true`), `.ams-detail` (revealed with a `grid-template-rows` or `max-height` plus opacity transition), `.ams-po-row`, `.ams-pill` (orange for `.multi`, muted for single), `.ams-ai` (sparkle title, chip `.ams-dummy-chip`), `.ams-drawer`, `.ams-actions` buttons (reuse `.button` and `.button.ghost`), `.ams-state` (loading/error/empty text). Add `.po-marker.scenario-ring::after{...}` as an absolutely positioned ring (for example 30px circle, 2px dashed or solid `#c084fc` violet, soft glow, `pointer-events:none`, `animation` guarded by the existing reduced-motion rule). It must not set background or border colour on `.core` or `.halo`, so the `status-*` colours remain.
      Responsive: `@media(max-width:800px)` stack the PO row pill under the name when narrow, card risk label wraps below the title; `@media(max-width:540px)` smaller KPI values and padding.
      Files: HTML file only.
      Verify: Node syntax check is not applicable to CSS. Open the page in headless Edge (step 11 harness) and confirm no console errors and that existing panels' bounding boxes are unchanged against the original (compare `.map-panel`, `.analytics-col`, `.triple-row`, `.bottom-grid` rects between the original and the new file at 1440 px).

- [ ] 2. Insert the panel markup between line 100 (`</main>`) and line 101 (`<section class="bottom-grid">`). Placement is full width, directly above the weather/MET box and below the 4-panel row (the `.triple-row` is inside `.left-col`, so the panel naturally goes after `</main>` and does not affect the aligned heights of the map, right column and panel row).
      Markup (static shell; dynamic parts filled by JS):
      `<section class="panel ams-panel" id="amsPanel" aria-labelledby="amsTitle">` containing a header (`brain` inline SVG, `<h2 id="amsTitle">AI Multi-Scenario Monitoring</h2>`, subtitle `Pemantauan pelbagai senario dan PO terlibat`, `<span class="tag ams-badge" id="amsBadge">DATA DUMMY</span>`), `<div id="amsState" role="status" aria-live="polite"></div>`, `<div class="ams-kpis" id="amsKpis"></div>`, `<h3 class="ams-section">Senario Cuaca yang Dikesan</h3>`, `<div id="amsList" class="ams-list"></div>`, `<div id="amsDetail" class="ams-detail" hidden></div>`.
      Check IDs `amsPanel`, `amsTitle`, `amsBadge`, `amsState`, `amsKpis`, `amsList`, `amsDetail` are not used elsewhere (grep first).
      Files: HTML file only.
      Verify: page loads with no console errors, and the panel sits between the 4-panel row and the weather/MET box.

- [ ] 3. Add a new `<script id="amsData">` block is NOT used. Add new JS in one new block placed after line 209 is wrong, because `DASHBOARD_TEST` is declared at 209. Instead insert the new code inside the existing `<script>` immediately BEFORE line 208 (`initControls();renderAll();`), so that `renderAll()` can call it on first run. Use a clearly commented section header `/* ===== AI Multi-Scenario Monitoring (data, service, UI) ===== */`.
      Part A, data: `const SCENARIOS_DUMMY=[...]` with the 3 scenarios and every field in the spec (`scenarioId, scenarioName, warningType, source, issuedAt, validFrom, validUntil` (ISO strings 2026-11-14, ending 2026-11-1x), `affectedStates, affectedDistricts, affectedPOIds, riskLevel, affectedCommodities, recommendedActions[], dataStatus:'dummy'`). Do NOT include `relatedScenarioIds`; derive it with `relatedIds(sc)`. Put `affectedPOIds` as ids (`kelantan,terengganu,pahang` / `johor,simpangrenggam,melaka` / `kelantan,pahang`). Separate map `const AI_INSIGHTS_DUMMY={S01:{summary,cadangan,status:'dummy',generatedBy:'dummy'},...}` with the exact Malay texts from the task spec (S01, S02, S03). `recommendedActions` is an array derived from `cadangan` split into short action strings, for example S03: `['Utamakan semakan akses logistik','Semak stok komoditi di PO terlibat','Nilai keperluan mobilisasi dari PO lain dalam zon']` (write natural Malay; keep the `cadangan` string as the main displayed text).
      Part B, service layer `const ScenarioService={...}`: `async loadScenarios()` returns `{status:'dummy',data:SCENARIOS_DUMMY clone}` after `await Promise.resolve()` (no timer, so tests are deterministic); `validateScenario(o)` checks required keys and types, `riskLevel` in `sederhana|tinggi`, `affectedPOIds` all present in `poById`, ISO dates parse; returns `{ok,errors}`; `async fetchAIInsight(id)` returns the dummy insight with `source:'dummy'`. Comments: future pipeline MET Malaysia/JPS -> processing -> geospatial match with PO -> scenario grouping -> AI API (backend) -> insight -> dashboard; placeholder `POST /api/ai/scenario-insight` on a secure backend; no API keys in the frontend; MET hook = existing `Amaran Rasmi MET` widget and `DATA.cuaca`; JPS hook = `DATA.banjir`. Invalid scenarios from `loadScenarios` are filtered out and logged with `console.warn` only when invalid (none expected).
      Part C, derived data helpers (pure, no DOM): `poScenarioMap()` (poId -> array of scenarioIds computed from `SCEN_LIST`), `scenarioStats()` returns `{scenarios,uniquePO,overlapPO}` where scenarios = `SCEN_LIST.length`, uniquePO = size of the set of all `affectedPOIds`, overlapPO = count of POs with 2 or more scenarios; `relatedIds(sc)` = other scenarios sharing at least one PO; `joinMalay(list)` ('A, B & C' for card state lines; 'A, B dan C' for commodity text); `poName(id)` = `poById[id].name`.
      Files: HTML file, new block before the `initControls();renderAll();` line.
      Verify: extract the inline script and syntax check: `node -e "const s=require('fs').readFileSync('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html','utf8');const m=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];m.forEach(x=>new Function(x[1]));console.log('ok')"` prints `ok`. Run from the workspace root.

- [ ] 4. In the same new block, add render functions (all dynamic text through `esc()`):
      `renderScenarioPanel()` (entry point: shows state message for `loading`/`error`/`empty`, renders KPIs, list and detail, and updates the badge from `dataStatus`), `renderScenarioKpis()` (labels `Senario`, `PO unik terlibat`, `PO bertindih`, values from `scenarioStats()`), `renderScenarioList()` (one `<button type="button" class="ams-card" data-sid aria-expanded aria-controls="amsDetail">` per scenario with weather SVG chosen by `warningType` (rain cloud / thunder cloud / flood waves; `hujan_berterusan`, `ribut_petir`, `amaran_banjir`, default generic cloud), `<b>S01 · Hujan Berterusan</b>`, states line, `N PO berkaitan · source`, risk label `Risiko Sederhana|Risiko Tinggi`, chevron), `renderScenarioDetail()` (empty and `hidden` when `state.scenario` is null; otherwise header `Senario Dipilih: S0x` + risk pill, `PO YANG BERKAITAN` list, AI Insight block with sparkle SVG, paragraphs `Komoditi:` and `Cadangan:`, the chip `Contoh data dummy — bukan hasil model AI sebenar`, buttons `Kembali ke Senarai Senario` and `Lihat Pilihan Intervensi`, plus the PO drawer), `poDrawerHTML(poId)`.
      PO rows: `<button type="button" class="ams-po-row" data-po aria-expanded>` with pin SVG, `poName`, pill `${n} senario` (class `multi` if n>=2), and `Juga dalam S0x` listing the other scenario IDs of that PO.
      Drawer content (spec e): PO name, negeri, scenario IDs, union of commodities, risk text from scenarios' `warningType` display names and risk, logistics from `DATA.po[].logistik` (read-only; `Angka gabungan: A + B` when `shared`; `Tidak tersedia (dummy)` when missing), separate block `Status bekalan/harga komoditi (berasingan daripada amaran cuaca)` showing worst status via `poStatus`-style logic over `DATA.rekod` of that PO for matching commodities (`commodityMatch(name)`: `Cili Merah` -> `Cili Merah`, `Tomato` -> `Tomato Bulat`, others null -> `Data harga tidak tersedia (dummy)`), a note that a weather warning does not make a PO red automatically, the scenario's `recommendedActions`, and button `Lihat harga komoditi PO ini`. Drawer has a close button (`Tutup`).
      Weather text mapping `WARNING_LABELS={hujan_berterusan:'Hujan berterusan',ribut_petir:'Ribut petir & angin kencang',amaran_banjir:'Banjir'}` with a fallback to `warningType`.
      Use `statusHTML` and `labels` for the status text. Do not use `innerHTML` with unescaped values.
      Files: HTML file.
      Verify: syntax check as in step 3, then the browser checks in step 11.

- [ ] 5. In the same block, add interaction handlers (event delegation on `#amsPanel`, registered once):
      `selectScenario(id)`: toggle (`state.scenario=state.scenario===id?null:id`), clear `state.scenarioPO`, call `renderScenarioPanel()`, then `renderMap()` ring refresh via `renderAll()`-safe path (call `renderMap()` only, not `selectPO`), `fitScenarioPOs()`, and when opening `$('amsDetail').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})`. Move focus is not needed; keep focus on the card (re-render must restore focus to the card with `data-sid` if it was focused, because list is re-rendered; simplest is to only toggle classes/`aria-expanded` in the list rather than replace the list when selection changes).
      `backToScenarioList()`: `state.scenario=null; state.scenarioPO=null`, re-render, `renderMap()`, scroll `#amsPanel` to the top (`block:'start'`), focus the previously selected card.
      `openScenarioPO(poId)`: set `state.scenarioPO` (toggle off if same), re-render the drawer only, and fly the map using the existing `selectPO` is NOT used here (it changes filters); instead call the new helper `fitScenarioPOs([poId])`.
      `viewPOPrices(poId)`: pick a matching commodity (`commodityMatch`), set `state.komoditi` and `$('filterCommodity').value` when matched (else leave unchanged), then call existing `selectPO(poId)`. Because `selectPO` calls `renderAll()` and the panel re-renders from state, the open scenario and drawer stay open. Note `selectPO` scrolls to `.map-panel`; that is existing behavior, keep.
      `scenarioInterventionContext()`: candidate POs = `state.scenarioPO ? [state.scenarioPO] : scenario.affectedPOIds`; candidate commodities = matched price names of scenario commodities; search `DATA.rekod` with `peringkat==='Borong'`, `poId` in candidates, `komoditi` in matched names; choose max `weight[status]`; if none, fall back to the first candidate PO's worst-status Borong record and call `toast('Konteks senario dihantar; tiada rekod harga sepadan untuk komoditi senario.')`. Then call `openActionModal(record.id,{note:'Konteks senario S03 · Amaran Banjir · PO Kota Baharu · Komoditi: Cili Merah, Sawi dan Timun'})` (built from data). Never saves anything.
      Initial load (async): `ScenarioService.loadScenarios().then(r=>{SCEN_LIST=...;state.scenarioLoad=...}).catch(()=>{fallback to SCENARIOS_DUMMY; state.scenarioLoad='error' with message 'Gagal memuatkan senario — memaparkan data dummy'}).finally(renderScenarioPanel)`. Initial synchronous render shows `Memuatkan senario…` (so the first `renderAll()` before the promise resolves does not crash). Empty list shows `Tiada senario amaran dikesan`.
      Keyboard: native `<button>` handles Enter and Space. Add `Escape` on the drawer to close it (optional, low risk).
      Files: HTML file.
      Verify: browser checks in step 11.

- [ ] 6. Hook the panel into `renderAll()` (line 203). Do a minimal targeted `str_replace` on the unique substring `renderQueue();const selected=state.po?poById[state.po]:null;` replacing it with `renderQueue();renderScenarioPanel();const selected=state.po?poById[state.po]:null;`. Define `renderScenarioPanel` as a function declaration (hoisted) and make it a safe no-op if `SCEN_LIST` is not ready, so `renderAll()` called at first load is safe. Do not otherwise edit the line.
      Files: HTML file, line 203.
      Verify: selecting a PO on the map and changing `#filterState`, `#filterCommodity` and Reset still work, and an open scenario detail stays open and is re-rendered (browser test).

- [ ] 7. Map ring and fit helper (inside the map closure, lines 150 to 201).
      (a) Line 163: in the `po-marker` class template literal, add a call to a global function: change `` `po-marker status-${s}${state.po?' compact':''}` `` to `` `po-marker status-${s}${state.po?' compact':''}${scenarioRingClass(p.id)}` ``, where `scenarioRingClass(id)` (defined in the new block, global) returns `' scenario-ring'` when `state.scenario` is set and the scenario's `affectedPOIds` contains `id`, else `''`. Status classes stay unchanged. Also append to the existing `aria-label`? No: leave labels unchanged; add `title` only if it does not conflict with the hover popup (skip it).
      (b) Add `function fitScenarioPOs(ids){...}` inside the closure next to `zoomTo` (line 172): resolve `lat/lon` from `poById`, return if `!map` or no coordinates, build bounds with `new maplibregl.LngLatBounds()`; single PO uses `map.flyTo({center,zoom:8})`; multiple uses `map.fitBounds(b,{padding:60,maxZoom:8})` guarded: if `!map.loaded()` use `map.once('load',...)`. Do not change `zoomTo` or `mapView`. Because `applyMapView` may re-run on re-render, check lines 172 to 200 to ensure `renderMap` does not call `applyMapView` on every render. If it does, set `mapView=null` is not allowed; instead call `fitScenarioPOs` after `renderAll`. Expose with `window.__amsFitPOs=fitScenarioPOs` set inside the closure (a single assignment line), and call `window.__amsFitPOs&&window.__amsFitPOs(ids)` from the new block. If `state.po` is set (district zoom), skip fitting so the user's filter zoom is not overridden.
      (c) Rings update: `renderMap()` rebuilds all markers on every call (line 161), so `scenarioRingClass` is applied automatically whenever `renderMap()` runs. The new block calls `renderMap()` after scenario changes; `renderMap` is closure-local, so also assign `window.__amsRenderMap=renderMap` in the closure, or simply call `renderAll()`. Chosen: call `renderAll()`, because it is simplest and safe now that scenario state lives in its own fields. Then no `__amsRenderMap` is needed. To keep the detail's scroll and focus stable, `renderScenarioPanel` must preserve list DOM (toggle classes) rather than rebuild it when only selection changes.
      Files: HTML file, lines 163 and 172 areas.
      Verify: in the browser, after `selectScenario('S03')` the markers for `kelantan` and `pahang` have class `scenario-ring` and others do not; each marker's `status-*` class equals its class before selection; after collapse no marker has `scenario-ring`.

- [ ] 8. `openActionModal` optional second argument (line 204). Two small `str_replace` edits, default behaviour intact:
      (a) signature: `function openActionModal(recordId){` -> `function openActionModal(recordId,opts){`.
      (b) after the modal HTML is assigned and before `const close=`, prefill: `if(opts&&opts.note){$('actionNote').value=opts.note;}`. Anchor: the unique substring `const close=()=>{$('modalMount').innerHTML=''};` -> prepend the prefill statement. Optionally add a small non-persistent note below the textarea is NOT needed.
      Existing callers (`openActionModal(id)`) must behave as before; the textarea placeholder stays.
      Files: HTML file, line 204.
      Verify: browser: clicking an existing queue item opens the modal with an empty note; `Lihat Pilihan Intervensi` opens it with the note prefilled; `localStorage['fama-demo-intervensi-v1']` unchanged after opening and cancelling.

- [ ] 9. Expose test helpers (line 209). Replace `window.DASHBOARD_TEST={state,DATA,selectPO,selectDistrict,renderAll,filteredRecords,poStatus};` with the same object plus `scenarioStats,selectScenario,openScenarioPO,backToScenarioList,scenarioList:()=>SCEN_LIST,setScenarios:(list)=>{SCEN_LIST=list;renderAll();}` (setScenarios is for the temporary 4th-scenario test). Because `SCEN_LIST` is declared with `let` in the new block, which is before line 209, it is in scope.
      Files: HTML file, line 209 (the original line, shifted by inserted lines).
      Verify: `window.DASHBOARD_TEST.scenarioStats()` returns `{scenarios:3,uniquePO:6,overlapPO:2}` in the browser.

- [ ] 10. Static checks (run from the workspace root):
      - Syntax check from step 3 prints `ok`.
      - Duplicate ids: `node -e "const s=require('fs').readFileSync('Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html','utf8').split('\n').filter((l,i)=>i!==108).join('\n');const ids=[...s.matchAll(/\sid=\"([^\"]+)\"/g)].map(m=>m[1]);const d=ids.filter((x,i)=>ids.indexOf(x)!==i);console.log(d.length?d:'no duplicates')"` (skips the DATA line index 108).
      - Hardcode check: `grep_search` over the new block for display literals `>3<`, `>6<`, `>2<`; expected none (KPIs come from `scenarioStats()`).
      - Original content preserved: compare against `.agents/tasks/original-before-ai-panel.html` with `fc` or a node script; the DATA line 109 must be byte identical, and the diff must contain only the planned insertions and the 3 small edits (lines 163, 203, 204, 209).

- [ ] 11. Browser verification with a script saved as `.agents/tasks/ams-test.js`.
      Tooling found: Microsoft Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`; Node v24.19.0; Playwright browsers cache in `%LOCALAPPDATA%\ms-playwright` (chromium-1234 and headless shell); the earlier run used `puppeteer-core` (script `.agents/tasks/bt/t.js`, launching Edge with `headless:'new'` and args `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). `require('puppeteer-core')` does not currently resolve from the workspace root, so run `npm install puppeteer-core --prefix .agents/tasks/bt --no-save` once (or `npm init -y` there first) and run the script from there. Fallback if npm is blocked: `npx playwright` is not required, use `playwright-core` with `executablePath` set to the Edge path.
      Page loads from `file:///` with the MapLibre script from unpkg and tiles from basemaps.cartocdn.com, so it needs network. Wait for `.po-marker` then 3 seconds. Collect `console` errors and `pageerror`, ignoring only network tile warnings already present in the original (compare with a run of `original-before-ai-panel.html`).
      Assertions (all required):
      1. Default: `#amsList .ams-card` count 3; KPI texts `3`, `6`, `2`; `#amsDetail` hidden/empty; badge reads `DATA DUMMY`.
      2. Click S01: card has class `sel` and `aria-expanded="true"`; detail has the exact S01 insight text; PO rows (names from `DATA.po`: PO Kota Baharu, PO Kuala Terengganu, PO Kuantan) with pills `2 senario`, `1 senario`, `2 senario`; risk badge `Risiko Sederhana` with orange computed colour.
      3. Click S02: pills `1 senario` x3 (PO Johor Baharu, PO Simpang Renggam, PO Ayer Keroh); only one `.sel`; S01 detail gone.
      4. Click S03: two PO rows with `2 senario`; exact insight text; badge `Risiko Tinggi` red; `Juga dalam S01` visible on both rows.
      5. Click S03 again collapses (no detail, no `.sel`, no `scenario-ring`). Click S01 then `Kembali ke Senarai Senario` restores overview and scrolls the panel to top.
      6. Keyboard: focus a card, press Enter opens; press Space on another card selects it; focus ring visible (outline not `none`).
      7. PO row click opens drawer with logistics numbers equal to `DATA.po` values and the separate commodity status block; `Lihat harga komoditi PO ini` sets `DASHBOARD_TEST.state.po`, `#filterState` value equals that PO id, and the scenario panel stays open; the PO drawer note states the weather/supply separation.
      8. Map rings: with S03 selected, markers with `scenario-ring` are exactly two (kelantan and pahang; find by `aria-label` prefix `PO Kota Baharu`, `PO Kuantan`); every marker's status class equals its pre-selection class.
      9. `Lihat Pilihan Intervensi` for S03 opens `#modalBack`, `#actionNote` begins with `Konteks senario S03 · Amaran Banjir`, and `localStorage['fama-demo-intervensi-v1']` is unchanged. Repeat for S01 with a PO whose commodity does not match to check the fallback toast text.
      10. Data-driven check: via `DASHBOARD_TEST.setScenarios([...three, S04 overlapping johor and kelantan])` the card count becomes 4 and KPIs recompute (`4`, `7`, `4` expected given S04 pos `johor`,`kelantan`; compute in the test instead of trusting this number), then restore the original list and confirm 3/6/2. Nothing persistent.
      11. Existing features: change `#filterState` and `#filterCommodity`, press `#resetFilters`, click a PO marker (opens zoom, hover popup shows on mouseenter), `#backMap` works; none collapses the AMS panel unexpectedly except that Reset does not clear the scenario (documented).
      12. Layout regression: bounding-box heights of `.map-panel`, `.analytics-col`, `.triple-row` panels and `.bottom-grid` equal the values measured on the original file at 1440 px.
      13. No console errors and no `pageerror` in the whole run.
      Screenshots at 1440, 1024 and 390 px widths (default and S03 selected with drawer) saved under `.agents/tasks/` as `ams-1440-default.png`, `ams-1440-s03.png`, `ams-1024-*.png`, `ams-390-*.png`; open each with `read_file` and inspect for overflow, clipped text, and contrast. At 390 px check there is no horizontal page scroll (`document.documentElement.scrollWidth<=innerWidth`).
      Write results to `.agents/tasks/ams-verification.md`.

## Function list (new, all global in the new block unless noted)

`SCENARIOS_DUMMY`, `AI_INSIGHTS_DUMMY`, `WARNING_LABELS`, `ScenarioService{loadScenarios,validateScenario,fetchAIInsight}`, `poScenarioMap`, `scenarioStats`, `relatedIds`, `joinMalay`, `commodityMatch`, `scenarioRingClass`, `renderScenarioPanel`, `renderScenarioKpis`, `renderScenarioList`, `renderScenarioDetail`, `poDrawerHTML`, `selectScenario`, `backToScenarioList`, `openScenarioPO`, `viewPOPrices`, `scenarioInterventionContext`, `weatherIcon(warningType,risk)`, `fitScenarioPOs` (inside the map closure, exposed as `window.__amsFitPOs`).

## Edits to existing lines (complete list)

1. Line 163: ring class appended in the `po-marker` class template.
2. Line 172 area: new `fitScenarioPOs` function plus one `window.__amsFitPOs=` assignment inside the closure.
3. Line 203: `renderScenarioPanel();` added after `renderQueue();`.
4. Line 204: `openActionModal` signature and the prefill statement.
5. Line 209: `DASHBOARD_TEST` additions.

Everything else is additive (new `<style>`, new `<section>`, new JS block before `initControls();renderAll();`).

## Assumptions and gaps

- Placement after `</main>` and before `.bottom-grid` as in the spec. The panel is a standalone `.panel`, not inside the bottom-grid box.
- Names come from `DATA.po` (`PO Johor Baharu`, not `Johor Bahru`), per the task brief. This differs from the user's original wording by design.
- The truncated part of the user request after S01 `Cadangan` (S02/S03 insight texts, and any remaining requirements) is covered by the task spec above, which supplies S02 and S03 texts verbatim.
- Screenshots 1 and 2 from the user are not available in the workspace. Layout follows the written spec.
- Ring colour is violet (`#c084fc`) so it does not clash with the red, yellow and green status colours or the orange/red scenario colours.
- No FEAT decomposition and no workflow tail replacement: the original loop runs unchanged with its gate file `ams-review.json`.

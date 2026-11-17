# Design Review: Dashboard Intervensi Komoditi (revision 3)

Reviewed: `.agents/tasks/intervensi-design.md` against `.agents/tasks/intervensi-task.md` and the real `Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html`.

Verdict: **CHANGES_REQUESTED** (0 HIGH, 4 MEDIUM, 6 NIT)

The structure and integration plan hold up against the real file. The remaining problems are internal contradictions in rules the coder must implement. Each is a small text fix.

## Findings

### 1. MEDIUM: Anchor trigger rule contradicts itself (B5.6 rule 3, B11 T4/T5, B13 step 7c)
B5.6 rule 3 says the engine trigger "must be above zero". The failure message it shows is "PO terpilih tiada lebihan/kekurangan bekalan **yang disahkan**". "Disahkan" is defined in B5.3 as surplus >= max(3 MT, 15% of net), or coverage < 0.8 with shortage >= 3 MT, and fresh data.

The two rules give different results for T4 (Kangar surplus 0.5 MT) and T5 (Samarahan surplus 9 MT, stock 5 days old, `lapuk`). Both are above zero but not confirmed. A "Tindakan" click on a Waspada row (every T4/T5 row) lands in Paparan 4. The coder cannot tell whether the lists run or the message appears. B13 step 7c ("Samarahan case ... banner appears, no exception") also depends on which rule applies. It does not say whether the flood banner shows when the engine returns no lists.

Fix: replace the trigger sentence in rule 3 with:
> "The engine runs only if `supplyConfirm(mode, anchorSupplyRow).state === 'disahkan'`. Otherwise it returns `{dalam:[], luar:[], trigger:{ok:false, reason: state}}` and Paparan 4 shows 'PO terpilih tiada lebihan/kekurangan bekalan yang disahkan' plus the reason ('Menunggu pengesahan bekalan' / 'Data stok lapuk' / 'Tiada data bekalan'). The anchor flood banner is rendered independently of `trigger.ok`."

Then change B13 7c to say the Samarahan/T5 case asserts: banner present, message present, no lists, no exception.

### 2. MEDIUM: "Disahkan" means two different things in the UI (B3.5, B3.7, B4.4, B4.5)
Paparan 3 appends "+ lebihan bekalan disahkan" / "+ kekurangan bekalan disahkan" when `supplyConfirm` is `disahkan`. Paparan 4 states stock status is "Belum disahkan" and "the UI never states stock is verified". The data model also contradicts this: B3.5 sets `stockVerified:true` on every generated row, and B3.7 allows `stockVerification:'disahkan (dummy)'`. A user sees "lebihan bekalan disahkan" for Kluang in Paparan 3 and "Belum disahkan" for the same stock in Paparan 4. The field values contradict each other.

Fix, with exact wording:
- Rename the P3 suffix to " + lebihan bekalan dikesan (data dummy)" and " + kekurangan bekalan dikesan (data dummy)". Keep `disahkan` only as the internal `supplyConfirm.state` name. Update B13 step 6b and AC-5 strings to match.
- Delete `stockVerified` from B3.5. Define `stockVerification` in B3.7 as a single constant: `'belum disahkan'`. Remove `'disahkan (dummy)'`.

### 3. MEDIUM: Tab click before settle is both "queued" and "allowed at any time" (B1 "Deep link and first show")
The same paragraph says a click before `load` and `famaScenariosReady` settle "is queued and applied at the same point". It then says "Clicking the tab by hand is allowed at any time (the old map is then simply resized on return)". These are two different behaviours: the tab either switches immediately or it waits. The tab button is shown as "(memuatkan)" and "enabled", which suggests an immediate switch.

Fix: pick one. Recommended rule:
> "A manual click switches immediately, with no queue. Only the hash-driven open (`#intervensi` at load) waits for `Promise.allSettled([loadPromise, famaScenariosReady])` plus one frame. A manual click made before settle shows the P4 chip 'Amaran cuaca/banjir AMS sedang dimuatkan', and `ivRefreshScenarios()` re-renders when the promise settles."

Remove the sentence about queuing manual clicks. Also state a safety cap: if either promise has not settled after 3000 ms, apply the hash anyway.

### 4. MEDIUM: "Nothing negative is ever rendered" contradicts expected margin values (B4.6, B5.8, B13 step 8)
B4.6 says "Nothing negative is ever rendered: any negative or non-finite value is replaced by '—'". B5.8 and B13 step 8 require the farm-price card to show "margin impact -3.00 percentage points". Current margin is also legitimately negative when `F + C > S`. Spread can be negative when `beli > jual`. Under the literal B4.6 rule, the pinned fixture fails its own assertion.

Fix: scope the rule to recommended prices:
> "Any recommended price (`MaxFarmPrice`, `MinSell`, range ends) that is negative, zero or non-finite is shown as '—' and the card shows the infeasible text. Margin %, margin impact (pp) and spread are signed values and are displayed as computed, with a minus sign, and `NaN`/`Infinity` is shown as '—'."

Also state how `beli > jual` is handled (accept and show a negative spread, or flag the field with 'Harga Borong Beli melebihi Harga Borong Jual').

### 5. NIT: "Prices used" for mobilisation is ambiguous when an overlay exists (B5.6, B11 T1b)
B5.6 says "Borong price ... at the current period". B3.4 defines `actual` for an overlay as `baseline*(1+dev/100)`, where `baseline` is the mean of the last 7, 14 or 30 values. Non-overlay POs use the last value. I recomputed the pinned T1b numbers from `DATA.rekod`. The perak overlay price is 15.25 to 15.29 and the gap is +0.58 (7 days), +0.61 (14) and +0.62 (30). B11 says "about 15.4" and "about +0.7". The eligible sets still hold at every window, so the tests pass. The text does not match the numbers.

Fix: define "price used = `ivPrice(po, commodity, 'Borong').actual`, averaged over the PO's districts". Change the B11 figures to "about 15.29 RM/kg, gap about +0.62 at the default 30 hari".

### 6. NIT: Header, CSV buttons and footer stay visible on the new tab (B1 E2/E3)
In the real file, `<header class="topbar">` (line 185 to 188) holds the h1 "Dashboard Pemantauan & Intervensi Komoditi", the "DATA DUMMY" tag and the buttons `#downloadLogistik` and `#downloadCsv`. Line 242 `<footer>` holds the old data-limits text. E3 wraps only lines 189 to 241, so on the new tab the header buttons export old-tab data and the footer describes the old page.

Fix: state the intent. Recommended: keep the header and footer shared, and add the sentence "Butang CSV mengeksport data tab Pemantauan Komoditi" as a `title` attribute, or hide the two buttons while the new tab is active with `body[data-iv-tab=intervensi] #downloadCsv, … {display:none}`.

### 7. NIT: `grade` missing from CommodityPrice (B3.4 vs brief data model)
The brief lists `CommodityPrice (actual, forecast, thresholdLow/High, grade, unit, priceLevel)`. B3.4 has no `grade`.

Fix: add `grade: null` (the existing data has no grade field; `Telur Gred A` is a commodity name). Add a one-line note "gred tidak tersedia dalam data sedia ada".

### 8. NIT: Scoring wording conflicts (B4.5 vs B5.6)
B4.5 says scores come from "min-max over its own eligible set". B5.6 defines `priceScore = netGap / maxNetGap`, which is not min-max.

Fix: change B4.5 to "scores are normalised by the maximum within the list's own eligible set (B5.6)".

### 9. NIT: Muse record dates are unpinned, but a navigation limit depends on them (B5.9, B11 M01 to M09)
Prev is disabled when `weekStart` is below the earliest `recordDate` minus 14 days. B13 step 9 needs the 26 Oct week to be reachable. That holds only if the earliest `recordDate` is 9 Nov or earlier. Only M01 (11 Nov) and M06 (12 Nov) have record dates in the design. M09's event is 5 Nov, so its record date is 5 Nov or later.

Fix: add "M09 `recordDate` = 2026-11-06" (any value from 5 Nov to 9 Nov). Pin the other record dates in a table: M02 12 Nov, M03 13 Nov, M04 11 Nov, M05 13 Nov.

### 10. NIT: Supply rows are generated in MT for Telur Gred A (B3.5)
B3.5 generates 105 rows including Telur Gred A (`RM/10 biji`). The unit guard (B2) blocks P4 and P5 only. Paparan 3 can list Telur rows as "Dikesan" on MT-based supply confirmation, which has no meaning for eggs.

Fix: either skip supply rows for commodities with a non-`RM/kg` unit (so `supplyConfirm` returns `tiada` and Telur rows are never red), or add the note "Telur: bekalan dalam unit lain, tidak dinilai" to the P3 row.

## Verified Assumptions (read from the real file)

- Single file, 585 lines. Line 246 is the `const DATA = {...}` line (574 KB). `</style>` of `amsStyle` is at line 181, `</header>` at 188, `.source-strip` at 189, the `.bottom-grid` section closes at 241 and `<footer>` is at 242. The E1 to E3 anchors are correct.
- No tab system exists: no `role="tab"`, no `hashchange`. The main script is top-level, not an IIFE. `const`/`let` globals (`DATA`, `esc`, `toast`, `fmt`, `money`, `SCEN_LIST`) are readable from a second classic script.
- `.wrap` has no direct-child CSS selectors, so wrapping children in `#viewMonitor` does not change layout rules.
- `initScenarios();` is at line 582 and `initScenarios` is async and catches internally, so it always resolves. `DASHBOARD_TEST` exposes `state, DATA, selectPO, selectDistrict, renderAll, setScenarios, initScenarios, scenarioList`. `#backMap` and `#resetFilters` exist (lines 265 to 266). `#floodToggle`, `#showLogs`, `#filterCommodity`, `#filterState` and `#toast` exist.
- `MAP_BOUNDS` is at line 288 and `initMap` at 289. The CARTO style URL is a literal at line 290 (E5/E6 apply). `let map` is at line 287 and `initMap();` at line 310. `labelShift` is in line 300.
- 15 PO with the stated ids, names, `negeri`, lat/lon, `logistikGroup`. 50 districts total, with no duplicate district names. 13 distinct negeri. `DATA.po[].districts` entries are `[name, lat, lon]`. Kluang is under `simpangrenggam`, Pasir Mas under `kelantan`, Temerloh and Kuantan under `pahang`, Serian and Kuching under `sarawak`, Tuaran under `sabah`, Sepang under `selangor`. Dungun, Kemaman, Besut, Cameron Highlands and Matag are not in any PO.
- `DATA.po[].logistik` field names (`kenderaan, muatanMT, bilikSejuk, kapasitiSimpananMT`) match the design. Kota Kinabalu is 6 / 16.31 / 6 / 59.9. `johor_simpang` is 7 / 26.98 / 12 / 154.4, `ayerkeroh` 7 / 34.6 and `kotabaharu` 9 / 10.1. The readiness values 0.558, 0.833 and 0.130 and the 19.27 MT vehicle cap recompute correctly. Dengkil/Selayang and Johor/Simpang Renggam have `shared:true`.
- `DATA.rekod` has 1050 rows (50 districts x 7 commodities x 3 stages `Ladang|Borong|Runcit`), with 30 prices and `ramalan`, `hargaLantai`, `hargaSiling`. Telur Gred A is `RM/10 biji`. The other six commodities are `RM/kg`. No record naturally breaches the floor or ceiling, and none naturally moves more than 8% in the harmful direction, so the overlays are required to create alerts.
- `DATA.banjir` has Kota Bharu (Amaran, about 5 km from `kelantan`), Kuantan (Waspada) and Kuching (Amaran, about 27 km from Samarahan). AMS `S03` is `amaran_banjir`, `tinggi`, `affectedPOIds ['kelantan','pahang']`, valid 14 Nov 10:00 to 15 Nov 18:00. Other scenarios are `sederhana`.
- Existing outlets are 3 per PO with types Pasar Awam, PTKR and AKR, no district and no coordinates. `DATA.mapPaths` has 4 entries (country outlines).
- `.po-marker` and `.status-*` CSS is global (not scoped to `#map`), and `status-merah .halo` has the `pulsate` animation. A global `prefers-reduced-motion` rule exists (line 25). `scroll-behavior` appears once.
- Old code binds `[data-district]`, `[data-risk]`, `[data-open-action]`, `.price-row` and `#compareBody tr[data-record]` on `document`, as the design states. `.map-panel` is queried at line 285.
- T1/T2 numbers recomputed from `DATA.rekod` last Borong prices with 1.3 detour, 0.03 + 0.002 x km: johor +1.18 and selangor +0.62 from Simpang Renggam. Melaka +0.92, Negeri Sembilan +0.62, Selayang +0.62 and Pahang +0.82 toward Johor Baharu. Distances 159, 240, 317, 398 and 706 km match. Johor Borong mean is 15.00. The eligible sets in T1c and T2s hold.
- Margin fixture: Margin 18.00%, MaxFarmPrice 10.175, MinSell 12.0588, spread sd 0.0707, slope 0.0042, `mLow` 12.43 and `mHigh` 12.57 all recompute correctly.
- Calendar: 15 Nov 2026 is a Sunday, 9 Nov a Monday. Week counts for M01 to M09 hold (3 issues in W0, 2 in 2 to 8 Nov).
- `.agents/tasks/bt/node_modules/puppeteer-core` and the Edge path exist.

## Unverified / Wrong Assumptions

- Wrong: "gap about +0.7" and "about 15.4 RM/kg" for the perak overlay (B11 T1b). Actual is about +0.62 and 15.29 (finding 5). The test outcome is unaffected.
- Inconsistent: "Nothing negative is ever rendered" versus the expected -3.00 pp (finding 4).
- Inconsistent: "stock never verified" versus `stockVerified:true` and "lebihan bekalan disahkan" (finding 2).
- Unverified (not testable by reading): that `.po-marker` pulsing under the global reduced-motion rule (`animation-duration:.001ms`, still infinite) is acceptable. This is behaviour of the existing app, not a design defect.
- Unverified: the design's claim that the old test `bt/t.js` checks `animationName`. I did not open it, and the claim does not affect any rule.

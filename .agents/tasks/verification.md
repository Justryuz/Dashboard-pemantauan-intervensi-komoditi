# Verification

Backup of the original: .agents/tasks/original-dashboard.html (no git repo in workspace, so no commit made).

## Run
- Style URL fetch (node fetch): HTTP 200, 66873 bytes. maplibre-gl@4.7.1 js from unpkg: HTTP 200. Key accepted, style not swapped.
- JS syntax: extracted inline <script>, `new Function(src)` -> OK.
- Leftover grep (project(, mapSvg, geoLayer, markersLayer, districtLayer, floodLayer, currentViewBox, viewAnim, mkSvg, NAMESPACE, .geo-, map-water, waterline, mapGlow, mapGrid): all 0 hits. DATA.mapPaths data left in DATA, unused.
- Headless Edge + puppeteer-core (script: .agents/tasks/bt/t.js, screenshots map1-3.png there):
  - Voyager basemap renders (canvas present, screenshot shows tiles).
  - 15 PO markers, 15 labels, 7 red with `pulsate` animation, 3 flood markers.
  - selectPO('johor'): flies to Johor, 3 district markers, labels hidden, Malaysia back button visible.
  - Flood toggle off -> 0 flood markers; on -> 3.
  - #backMap -> full view, 15 labels, back button hidden. Clicking a PO marker -> district markers shown. #resetFilters -> full view.
  - No console errors or warnings, no page errors.
- A bug found and fixed during testing: `.po-marker{position:relative}` overrode MapLibre's absolute marker positioning; removed.

## Not verified
- Touch / mobile gestures (cooperativeGestures Malay text), real GPU rendering (used SwiftShader), keyboard Enter/Space on markers (handlers copied from the old code, not exercised), narrow-screen layout.
- Clicking a district marker (selectDistrict path unchanged, not exercised in browser).

## Notes
- Map uses `bounds` MAP_BOUNDS + padding 20 in the constructor instead of center/zoom, so Malaysia fits at any width. On a 928px-wide map the far west of Perlis sits near the left edge.
- zoomTo applies the camera at once if map.loaded(), else on 'load'.

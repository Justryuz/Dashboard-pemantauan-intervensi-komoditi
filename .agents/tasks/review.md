# Basemap swap: SVG map to MapLibre GL (Carto Voyager)

The SVG basemap in the dashboard is replaced by a MapLibre GL JS 4.7.1 map using the requested Voyager style URL. PO, district and flood markers are rebuilt as HTML markers on every `renderMap()`. `zoomTo(po|null)` keeps its name and now calls `fitBounds`. The non-map half of `renderMap` is unchanged.

Watch for: the flood marker tooltip does not show (possible), and keyboard and district-click paths were not exercised in the browser (confirmed, from the coder's own notes).

**Verdict**: APPROVED

## High-level view

Markers use the same classes, status colors, red pulse, label offsets and `aria-label`/`tabindex`/`role=button` as before. Enter and Space handlers and the `selectPO`/`selectDistrict` clicks are retained. Labels appear only when `!state.po`.

The map is created with `bounds` and padding instead of a fixed center and zoom. Cooperative gestures keep the page scroll from being hijacked, with Malay help text. `applyMapView` fits the PO and its districts with maxZoom 10, and fits Malaysia again on null. It runs at once if `map.loaded()`, otherwise on `load`. `initMap` is guarded when MapLibre fails to load, so the rest of the dashboard still works.

Verification evidence exists (`verification.md`). It covers a style fetch with HTTP 200, a syntax check, zero leftover grep hits, and a headless browser run with 15 PO markers, 7 pulsing, 3 flood markers and zoom/reset flows. I did not re-run any of it. I spot-checked the source: the CSS/JS CDN links are in head, `#map` is absolutely positioned and fills the frame, `.map-floating` has `pointer-events:none`, the frame background is neutral `#e6ebef`, flood dots are cyan/blue, and labels have a white halo. UTF-8 encoding is intact.

<details>
<summary>Issues (3)</summary>

1. **Flood marker tooltip** (possible, non-blocking): `.flood-dot` has `pointer-events:none`, so its `title` will not show on hover. Remove `pointer-events:none` if a tooltip is wanted.
2. **Unexercised paths** (confirmed, non-blocking): keyboard Enter/Space, district marker click, touch gestures and narrow-screen layout were not browser-tested. Do a manual check.
3. **Basemap needs network** (informational, non-blocking): the style and tiles load from Carto and unpkg. The dashboard works but the map is blank offline.

</details>

<details><summary>Details</summary>

## Marker lifecycle
`renderMap` removes all previous markers and rebuilds them from `statePOs()`, `state.po`, `state.daerah` and `state.banjir`. The selected district gets the `selected` class. This matches the requirement that stale markers are not left behind.

## Gaps
The DATA.mapPaths data stays in DATA, unused, which is harmless. The coder found and fixed a `.po-marker{position:relative}` override that broke marker positioning.

</details>

<details><summary>File map</summary>

- Dashboard_FAMA_Pemetaan_15_PO_Interaktif.html: SVG map code and CSS replaced by MapLibre map, markers and `zoomTo`.

</details>

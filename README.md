# WARBOARD

WARBOARD is a standalone browser planner for WARDOGS. Use it to mark up maps, plan flights, check firing-table estimates, and keep squad notes. Plans stay in your browser until you export or share them.

## Run it locally

Install [Bun](https://bun.sh), then run:

```powershell
bun install
bun run dev -- --port 5173 --strictPort
```

Open the local address Vite prints. To build the app, run `bun run build`. For production asset updates and local terrain preparation, see the scripts in `package.json`.

## Board

Choose Bakurani, Ozeti, or Zestafona. The map toolbar has layers, zoom, brightness, fullscreen, and panel controls. Draw routes and shapes, add notes or markers, measure distances, and undo or redo edits. Map coordinates use the full image bounds, with north at the top.

The **Terrain color (test)** layer uses locally bundled community imagery. Detail tiles load as you zoom; Zestafona detail is capped at 8K. The app can also show the original grayscale maps. The 3D terrain viewer uses the same local color tiles when color is selected. The app does not request map assets from Apollyon's CDN.

Import a PNG, JPG, or WebP image up to 20 MB, 8192 pixels per side, and 25 megapixels. Imported images are uncalibrated, so measurements use pixels until you have a scale reference.

## Flight planner

Open **Flight planner** from the navigation rail. Add waypoints by double-clicking the terrain or entering coordinates, then set altitude and reorder the route. The terrain profile shows sampled ground and flight elevations. Height exaggeration changes the display only.

**Auto route** creates an editable route preview from a spawn, tower, current-route endpoint, or coordinates. Review the preview and its clearance before applying it. Tree cover can be estimated from the color map in a local worker; inspect the result and correct missed trees or false positives. Tree heights and route clearances are planning estimates, not measured obstacle data or a flight guarantee.

## Fire support and squad notes

The Board includes Mortar and SPH-2 firing-table tools. Enter or place a gun and target to get horizontal range, bearing, and supported elevation values. The tables cover Mortar ranges of 132–684 m and SPH-2 ranges of 780–2,629 m. Results are estimates; they do not model a live shot. Terrain profiles are reference information, not a trajectory or line-of-sight calculation.

The plan briefing and checklist hold squad notes, resource counts, and a manually entered deployment budget. The Field guide has searchable notes and links.

## Plans, exports, and saved data

The browser stores the active board, per-map drafts, and named snapshots in IndexedDB. Display preferences use local storage. There is no account, analytics, backend, or cloud sync. Export a backup before clearing browser data.

Exports include editable `.warboard.json` plans, map PNGs, the current map view, and a text briefing. Older `.fieldboard.json` plans remain supported. Exports download to your device; share them yourself.

The production build caches the app shell and base maps for offline use. Detail tiles and terrain data are cached as needed, not all preloaded. A local server can prepare the full terrain data set.

## Shortcuts

`V` Select · `H` Pan · `P` Draw · `L` Line · `A` Arrow · `N` Note · `R` Measure · `C` Area · `E` Erase

`+` / `-` zoom · `0` fit map · `Delete` remove selection · `Escape` cancel · `Ctrl+Z` undo · `Ctrl+Shift+Z` or `Ctrl+Y` redo

Scroll to zoom. Alt-drag or middle-drag to pan. Touch screens support two-finger pan and pinch.

## Sources and asset rights

WARBOARD uses source data from [Apollyon's WARDOGS Calculator](https://github.com/apollyon-sys/wardogs-calculator), pinned to `c3252c9d24a22d1aad5d3fa4408807aef591bb56`. The app and its asset-preparation scripts use local files and do not fetch assets from Apollyon's CDN. The calculator's MIT license covers its licensed software; it does not by itself grant rights to WARDOGS game artwork or separately hosted assets.

The color map images are attributed to the community post ["Hi-res images of all 3 current maps"](https://www.reddit.com/r/WarDogs/comments/1w41e33/hires_images_of_all_3_current_maps_perfect_for/). The post documents provenance but does not state a redistribution license. See [the asset provenance notes](public/maps/community-color/PROVENANCE.md).

WARBOARD is a browser companion. It does not read or modify game files or access the game process, memory, packets, or live position data. This describes how the app works; it does not imply publisher approval.

## Checks

```powershell
bun run lint
bun run typecheck
bun run test
bun run build
```

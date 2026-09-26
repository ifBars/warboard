# 3D detail, visibility and sharing

These features reuse the obstacle data described in `obstacle-integration.md`. No new game data is bundled.

## 3D structures and trees

The Board 3D view derives three layers from the 8 m composite surface and tree canopy grids in a web worker (`src/terrainFeatures.ts`):

- **Bare ground.** A morphological opening (9-cell window) of the surface reproduces planar slopes exactly and removes narrow raised features. Only cells classified as structures take the opened height; ridges and knolls keep their surface height. The result replaces the 257-sample (≈64 m) overview mesh with a 1024-sample (≈16 m) mesh.
- **Structures and rocks.** Connected raised areas count as structures only when their edges drop like walls, losing at least 60% of their height within one cell. Smooth crests fall away over several cells and remain ground. Steep rock outcrops can still pass, so the toggle is labelled “Structures”, not “Buildings”. East-west runs of similar cells are merged into single boxes, about 98k boxes on Bakurani.
- **Trees.** Canopy envelope cells mark where canopy is, not individual trunks. A noise-clumped fraction of cells (roughly one in three to ten) gets a pine or broadleaf tree with varied height (55–95% of the envelope), width, lean and colour. Trees are drawn only within the camera window when zoomed in, with at most 40,000 of each type.

Drawings, labels and fire-mission connectors drape on the finer ground. Fire arcs in 3D are schematic connectors, not shell trajectories.

## Line of sight and coverage

Select a Measure line to check line of sight, or an Area circle to check coverage from its centre (up to 3 km radius). Observer and target heights are above ground, and presets cover infantry through high aircraft.

- Endpoint ground comes from the 2 m terrain chunks when available. Obstructions come from the 8 m structure surface, with a 0.5 m tolerance.
- Cells within 16 m of an endpoint are ignored, so a position's own cell cannot block it. Canopy within 25 m counts as that position's own cover.
- Coverage uses a radial sweep that tracks solid obstructions and canopy separately. Results are clear, seen only through trees, or blocked by terrain or structures.
- Heights are shown relative to the observer or gun. Per Apollyon's terrain notes, the dataset datum is offset by roughly 900 m, so absolute values are not meaningful.

Windows, fences, destructible objects, player bases and underpasses are not modelled.

## Share links

**Copy share link** (Plan menu) encodes a plan's drawings, markers, fire missions, briefing and base layout. It uses raw-deflate compression and base64url in the URL fragment, which is never sent to a server. The map image is not included. The receiver chooses whether to add the overlays to their own plan or replace it; either choice can be undone. Incoming links are size-capped (120k characters, 2 MB decoded) and pass the same `validatePlan` checks as imported files. Freehand strokes are simplified with a 1-pixel tolerance before sharing.

## Coordinate paste

Pasting a game coordinate copy (`x12.34, y56.78`) on the Board sets the gun first, then each later paste moves only the target. This is the workflow of [Wardogs Arty Buddy](https://github.com/doubletap-dave/wardogs-arty-buddy) (MIT); no code was copied.

## Reviewed tools and data not used

- **N4 Lab (wardogs.n4lab.dev).** Its terms prohibit AI and automated access and reproducing its functionality or look. Only its public feature summary informed the feature list; no assets, data, code or visual design were used.
- **Clutchbase HD surface.** Clutchbase publishes a 2 m composite surface, but it is keyed or obfuscated, so it was not decoded or used. Use it only with Clutchbase's permission.
- **RAWDOGS Field Calculator (AGPL-3.0).** Its L81 and SPH-2 tables are an independent capture of the same sight data already bundled from Apollyon, at coarser steps. No code or data was imported.
- **MarkusAureliusMaximus/wardogs-maps and djzet/wardogs-calc (MIT).** Reviewed for ideas: hillshade, contours and share links. Zestafona was added from Apollyon's data with the project owner's approval; see `DEPLOYMENT.md`.

## Relief layer and zones

- **Relief** (Map controls → mountain icon) overlays a hillshade (sun from the north-west, 2× vertical exaggeration) and 20 m contours, with index lines every 100 m. Both are computed in the browser from the derived bare-ground grid. The idea comes from [wardogs-maps](https://github.com/MarkusAureliusMaximus/wardogs-maps) (MIT); no code was copied. Contours are unlabelled because the height datum is offset. The layer is not included in PNG exports.
- **Zone** (G) draws a labelled polygon with its calibrated area. Click to add corners, then click the first corner, double-click or press Enter to finish.

## Zestafona

Zestafona has the base map, detail tiles, reference markers, 2 m terrain (fire-support profile, Flight planner) and the 3D overview mesh. The structure and tree-canopy grids cover Bakurani and Ozeti only, so Zestafona has no 3D structures or trees, relief layer, line-of-sight or coverage checks, and no colour imagery. Those controls are hidden or explain the limitation. Prepare scripts accept map ids, for example `bun scripts/prepare-terrain.ts zestafona`.

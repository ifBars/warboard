# Obstacle data and Base Builder

WARBOARD keeps running entirely in the browser. These additions use public community data; they do not access a running game or local game files.

## Sources shipped

- [Clutchbase public 3D maps](https://clutchbase.app/wardogs/3d/bakurani/) and [Ozeti](https://clutchbase.app/wardogs/3d/ozeti/): composite terrain/structure surfaces, tree instance transforms and LOD3 tree model bounds. Public manifest: https://clutchbase.app/data/wardogs/packs/manifest.json . Source URLs, elevation conversion and decoded SHA-256 hashes are pinned in `public/obstacles/manifest.json`.
- [Wardogs Zone base data](https://wardogs.zone/loadouts/base): 25 selectable buildables, dimensions, supply costs, maximum stacks and snap metadata. Snapshot: `src/data/buildables.json`, 2026-09-08. Base Builder currently uses dimensions and costs; it does not validate snap compatibility or stacking legality. FOB range is 60 metres each way, as described by the source UI.
- [Wardogs Zone Bakurani roads](https://wardogs.zone/maps/kavkazi) and [Ozeti roads](https://wardogs.zone/maps/europe): source road overlays and derived binary corridor masks. Their own full-image 163.84-unit calibration is retained. Roads influence combat-route preference; they never subtract measured obstacle heights or certify clearance.
- [Apollyon terrain](https://github.com/apollyon-sys/wardogs-calculator): existing 2 m terrain remains the ground reference and flatness input. Composite surfaces do not replace terrain elevations used by fire support.
- [MudcrabWarrior/wardogs-mcp](https://github.com/MudcrabWarrior/wardogs-mcp): research reference for locating the public catalog. No MCP service or third-party application code is bundled.

Other reviewed sources (wardogsFOBDesignOffice, omarchy-wardogs, ArsenalAirlines and artillery calculators) did not supply a better verified metric obstacle dataset. Their assumptions or aircraft performance claims are not imported as measurements.

These data attributions do not relicense game artwork. The project owner's permission to publish bundled game/community data was confirmed before deployment. No watermark was removed, inpainted, or used as visible map imagery by this change.

## Geometry and limitations

The structure surface is 2048 square (7.96875 metres per cell), with absolute elevation decoded using the pinned scale and offset. Ground alignment was compared with existing terrain at 400 positions per map: at a 163.2-unit span the central 80% of differences was about -1.7 to +2.1 m on Bakurani and -1.2 to +1.2 m on Ozeti. Using the image's 163.84-unit span for this surface causes substantially larger errors.

Tree envelopes use public mesh POSITION bounds, attached tree parts, instance scale, rotation and world location. Result: 846,794 Bakurani and 822,557 Ozeti placed instances resolved, with no unresolved tree-mesh entries. These counts include parts/shrubs/debris and are not counts of unique living trees. World coordinates are mapped to north-up game coordinates before rasterizing conservative axis-aligned envelopes.

The surface and canopy are separate arrays. Routing, route inspection and landing screening take their maximum; hand-marked hazards remain additional inputs. Positioned tree bounds take priority over the less reliable image classification in auto routing; image detection remains available for outlines and as a fallback when no placed-tree grid is supplied. Runtime verifies array sizes and SHA-256 hashes before use. The flight profile shows the sampled obstacle envelope separately from ground.

These grids cannot represent underpasses, windows, interior spaces or every wire/fence. Bounds can bridge a narrow gap that exists in geometry. The final clearance includes a horizontal sampling buffer, so it can be conservative near slopes and tree edges. No guarantee is made about destructible objects, player-built bases or changes between game builds. Source dates are data acquisition dates, not a verified game build number.

## Base Builder

Base layouts live in the existing per-map plan and IndexedDB draft, participate in undo/redo, and round-trip through portable plans. Standalone base JSON imports validate version, known catalog ids, finite coordinates, unique ids, piece count and file size. Local coordinates are metres east/north from a north-up map anchor. Copying to Board produces ordinary editable footprint annotations.

The 3D preview shows model envelopes, not meshes or collision simulation. Elevation, overlapping bounds, stack rules, doors and legal placement require in-game checks. Piece and anchor numeric controls are the keyboard alternative to dragging.

## Preparing updates

Run from the repository root:

1. Python 3 with NumPy: `python scripts/prepare-obstacles.py`. It downloads public tree metadata/models/instances into ignored `work/obstacle-research`, decodes the pinned composite surfaces, and writes compressed obstacle arrays. Existing files are cached. Updating sources requires deliberately replacing the pins and rechecking calibration.
2. `bun scripts/prepare-roads.ts` fetches pinned road overlays and creates 2048 binary masks plus hashes.
3. Re-run the application checks, inspect route clearance and narrow corridors, and verify Pages artifact size.

The app ships only the small compressed grids and catalog; preparation dependencies are not runtime dependencies. The deployment budget is 1,000,000,000 bytes, below the Pages 1 GB site limit; the build fails if it is exceeded.

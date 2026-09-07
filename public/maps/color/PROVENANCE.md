# Colored map provenance

Source: Wardogs Zone, retrieved 2026-09-06 local time. Original WebP bytes and site watermarks are preserved.

- Bakurani / Kavkazi: https://wardogs.zone/maps/kavkazi
  Asset: https://wardogs.zone/game/maps/kavkazi.webp?v=d054094b
  SHA-256: d054094b642199e9094a5813945b4598b5a876954b77126247fe93c5a87bd819
- Ozeti / Europe: https://wardogs.zone/maps/europe
  Asset: https://wardogs.zone/game/maps/europe.webp?v=ad175fb3
  SHA-256: ad175fb3be38107d9b49522630c9e549314c0a1e32f99e65f8ffaa97d8523f3f

Both are 5120 x 5120. Full-image registration to pinned Apollyon terrain was checked at 2048 square with SIFT, ratio 0.7, RANSAC partial affine threshold 3 px. Bakurani: 7720/7735 inliers, median residual 0.1136 px. Ozeti: 5882/5887 inliers, median residual 0.1283 px. Scale is effectively 1; no additional rotation or offset applied. This is image-to-image agreement, not an independent in-game survey. Game coordinates retain the pinned full-image tile bounds and north-up convention.

These are game artwork, not covered by the Apollyon software license. Included for the user's local unpublished companion. No redistribution rights are asserted. Do not publish bundled imagery without appropriate rights. Existing terrain assets and their upstream license remain separate.

Reproduce/verify assets: bun scripts/prepare-color-maps.ts

## Detection-only use

These original, unmodified images are inputs to the local tree detector only. They are not used as visible map textures or in PNG exports. Board and Flight display the original Apollyon terrain with derived tree outlines. Watermarks are not removed or obscured in the source assets.

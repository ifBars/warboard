# Community terrain color test

Original PNGs shared by Reddit user u/blahajSupremacy:
https://www.reddit.com/r/WarDogs/comments/1w41e33/hires_images_of_all_3_current_maps_perfect_for/

Drive folder: https://drive.google.com/drive/folders/1pL3f1YWoSGDMpMBCqWmywanbetiPBTGZ

Bakurani is 16384 square; Ozeti is 32768 square. Original files and research comparisons stay in `work/map-source-research`. `sources.json` records file URLs, byte sizes and SHA-256 hashes. Generate with `bun scripts/prepare-community-color.ts` after downloading the named originals. Sources are not Clutchbase or Wardogs Zone images. No watermark removal, generated recoloring, geometric warping or game-file extraction was performed.

The app uses a 4096px overview and 512px WebP tiles at successive powers of two, up to each original's native size. The shared Board 3D / Flight viewer starts with the overview and streams a bounded high-resolution tile window around the orbit target as the camera zooms, up to native resolution. Farther terrain retains the overview. Coordinates remain based on the original full-image bounds. SIFT/RANSAC alignment against grayscale at 2048px produced 7727 inliers / 0.0785px median identity residual for Bakurani and 6925 / 0.0898px for Ozeti.

Overview and sampled native-detail visual checks found no visible site watermark; this is not an exhaustive audit of every source pixel. User-authorized local evaluation only. WARDOGS artwork remains owned by its respective owners; the community download does not establish redistribution rights. Preserve these terms and resolve publication rights separately.

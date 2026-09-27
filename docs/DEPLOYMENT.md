# GitHub Pages

Production uses `/warboard/`, hash navigation, and browser-local saved plans. Local development stays at `/`. Local drafts do not transfer between localhost and the public domain; export plans to transfer them.

Push `main` to build and deploy with GitHub Actions. All four project checks must pass before deployment. The Pages artifact stores terrain chunks as `.bin.dgz`: a lossless left-neighbour delta with separate low/high byte planes, then gzip (about 45% smaller than gzip alone). The browser reverses both steps before the existing byte-count and SHA-256 validation. Native map tile resolution is unchanged. The artifact has a 1,000 MB size gate.

The earlier statement that Apollyon had approved redistribution of maps, terrain, icons, and detection imagery was incorrect and is retracted. Apollyon says he did not grant that permission and asked that builds stop using his paid asset service. That request is honored: map, detail, and terrain preparation scripts now verify the files already in this repository and make no network requests. The running app serves its bundled assets from WARBOARD's own origin.

This does not treat Apollyon as the owner of underlying WARDOGS game artwork. His upstream repository's MIT license covers original software; its legal notice says WARDOGS and other third-party assets remain with their respective rights holders. Extraction, conversion, or hosting by Apollyon alone does not establish ownership of the game artwork. The pinned source revisions and local asset provenance remain documented separately.

Zestafona was added on 2026-09-26. Its grayscale imagery and terrain chunks are checked into this repository and served by WARBOARD. The terrain manifest hash is pinned from Apollyon's repository at `d96c15ffc2c65dc31b4cceff8a9b12a7724467a6`; map markers and bounds use `maps/zestafona.json` at that revision. This records provenance, not ownership of the underlying game imagery.

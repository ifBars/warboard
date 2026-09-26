# GitHub Pages

Production uses `/warboard/`, hash navigation, and browser-local saved plans. Local development stays at `/`. Local drafts do not transfer between localhost and the public domain; export plans to transfer them.

Push `main` to build and deploy with GitHub Actions. All four project checks must pass before deployment. The Pages artifact stores terrain chunks as `.bin.dgz`: a lossless left-neighbour delta with separate low/high byte planes, then gzip (about 45% smaller than gzip alone). The browser reverses both steps before the existing byte-count and SHA-256 validation. Native map tile resolution is unchanged. The artifact has a 950 MB size gate.

The project owner confirmed permission to publicly redistribute the bundled maps, terrain, faction/tower icons, and detection imagery in the deployment conversation on 2026-09-07. Upstream provenance and license notices remain preserved; that confirmation does not relicense third-party artwork under the app's software terms.

Zestafona was added on 2026-09-26 with the project owner's approval in the development conversation. Its grayscale imagery (`zoom_4`/`zoom_5` tiles) and 2 m terrain chunks come from Apollyon's public asset release (`assets.wardogs-artillery.com/releases/assets-v1`). Chunk SHA-256 hashes are pinned from Apollyon's git manifest at `d96c15ffc2c65dc31b4cceff8a9b12a7724467a6`. Markers and bounds come from Apollyon's `maps/zestafona.json` at the same revision. As with the other maps, this approval does not relicense third-party artwork. The artifact is about 985 MB against the 1,000 MB gate, so check headroom before adding large assets.

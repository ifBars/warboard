# GitHub Pages

Production uses `/warboard/`, hash navigation, and browser-local saved plans. Local development stays at `/`. Local drafts do not transfer between localhost and the public domain; export plans to transfer them.

Push `main` to build and deploy with GitHub Actions. All four project checks must pass before deployment. The Pages artifact compresses terrain chunks losslessly with gzip; the browser decompresses them before the existing byte-count and SHA-256 validation. Native map tile resolution is unchanged. The artifact has a 950 MB size gate.

The project owner confirmed permission to publicly redistribute the bundled maps, terrain, faction/tower icons, and detection imagery in the deployment conversation on 2026-09-07. Upstream provenance and license notices remain preserved; that confirmation does not relicense third-party artwork under the app's software terms.

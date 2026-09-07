# WARBOARD project guidance

- Use Bun for dependencies and scripts.
- Keep this a standalone browser app. No game-process access, injection, memory access, packet interception, game-file extraction, authentication, analytics, or backend services.
- Keep Bakurani and Ozeti imagery real and source-attributed. Do not substitute fictional terrain under game-map names.
- Preserve the pinned map provenance and upstream license. Software licensing does not relicense game artwork. Do not publish the bundled imagery without appropriate rights.
- Use strict TypeScript, small components, event-driven state updates, and no direct React `useEffect`/`useLayoutEffect`.
- Treat imported plans and images as untrusted; maintain schema versions, size limits, allowlisted image types, and safe rendering.
- Preserve local drafts and unrelated edits. Use IndexedDB for plans and portable exports for backups.
- Retain the legacy Fieldboard storage keys and portable-plan compatibility. Preserve manual-data boundaries and explicitly label unverified firing estimates.
- Map geometry uses full-image tile bounds and north-up game coordinates, not playable bounds. Keep marker visual sizes independent of coordinate calibration.
- Keep the canvas dominant, controls compact, contrast readable, and mobile layouts usable. Respect reduced motion.
- Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`. Verify drawing, persistence, and export behavior in a browser for relevant changes.

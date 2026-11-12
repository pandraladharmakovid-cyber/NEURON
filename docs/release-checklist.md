# Release checklist
1. Back up/commit the target repository and preserve local edits. Apply full source sections and explicit scaffold removal list; never replay old phase generators.
2. Node 22.12+, pinned pnpm, frozen-lockfile install. Install Playwright Chromium.
3. Run pnpm release:check --browser: environment, source completeness, import boundaries, typecheck, unit tests, production builds, dependency audit and browser tests. Failed gates block release.
4. Inspect header enforcement and real media decoding/inference. Recheck backups, permission denial, capture cleanup, stale dataset handling and explicit peer import.
5. Review scope/codec/physical-device limitations. Test intended real devices and representative data; synthetic fixture accuracy is not an accuracy guarantee.
6. Only after operator approval configure production hosting/secrets and manually deploy. Verify HTTPS, shell cache, encoder download, same-origin relay, deletion and rate limits. No local test certifies cloud deployment.
7. Keep private user backups and a versioned source/build rollback. Do not clear production browser databases to make tests pass.

# NEURON application architecture — implemented through Phase 5

This document describes executed code, not all filenames in the original scaffold. The detailed path ledger in `docs/implementation-roadmap.md` is authoritative for unfinished paths.

## Running boundaries

- `apps/web`: React 18 / TypeScript / Vite app. Hash routing uses a typed parser. AppShell composes the actual Header/Sidebar modules. Providers hold camera/motion preferences and synchronize changes through same-origin storage events. The keyboard skip link focuses the workspace without navigating away from the hash route.
- Image studio: local project/class/sample CRUD; explicit camera still capture or JPEG/PNG/WebP imports; true normalization module Worker when Worker/OffscreenCanvas/createImageBitmap exist; DOM canvas fallback only when capability detection says these are unavailable. Unsupported/invalid worker content fails instead of silently claiming success. Images normalize to JPEG with <=768px longest side and white alpha background.
- Image training/inference: existing pinned MobileNet image embeddings plus learned softmax head, TensorFlow.js WebGL/CPU on the page. Classifier fitting is NOT moved to a worker by Phase 5. Image results are validation-set performance, not a separate unbiased final test. The view/hooks/components now live in the originally planned feature files rather than monolithic pages.
- CSV studio: Phase 4 parser and mini-batch linear-model trainer in real dedicated Workers; train-only preprocessing, grouped/stratified seeded splits, validation weight selection, held-out final test, immutable saved versions and row/batch prediction. No encoder download.
- Sharing: explicit encrypted image-model uploads to the optional relay. Raw datasets and deletion receipts are not included. CSV relay sharing, WebRTC/P2P and arbitrary model graphs are not implemented.
- Relay: actual R2 ciphertext storage, SQLite Durable Object rate limits, retained Phase 3 format/auth/origin/size/TTL/deletion checks and scheduled cleanup. The production configuration is deliberately fail-closed until an operator provisions private resources and exact allowed origins. Local Miniflare is not cloud deployment certification.

## Persistence

`neuron-local` IndexedDB v2 stores images/projects/model versions/feedback. `neuron-tabular` v1 stores CSV projects/current dataset/model versions. `neuron-sharing` v1 stores separate sensitive deletion receipts. Schema versions remain unchanged in this phase. Preferences alone use `neuron-preferences-v1` localStorage; blocked preference storage degrades to tab-local settings without resetting project databases.

Dataset class additions/renames transact against the latest project, avoiding lost updates from two simultaneous edits. Image-training commits now optionally check the original class vocabulary and exact sample ID/label membership inside the write transaction before saving/activating weights. Normal application samples are immutable records; deletion/addition changes membership. This is NOT content-version control for external/manual database tampering or a general multi-user synchronization protocol.

All backups restore NEW IDs. Model-only image import now also creates a NEW project; it no longer offers the old destructive “replace vocabulary/delete current images” Settings flow. Numeric model validation and whitelisted image-share serialization reject imported executable topology or hidden fields. User-reviewed export is local download, not publication.

## Camera lifecycle and privacy

The browser requests video only, never audio. No getUserMedia call occurs until explicit Use camera. A generation counter closes late streams after a cancelled/superseded permission request. Tracks stop on stop, unmount, hidden document, pagehide, disabled camera preference, or ended devices. The UI captures only an explicit still frame and applies normal image ingestion/prediction. Cross-tab preference events stop camera components in the other open tabs. Physical-device permission denial and busy/not-found cases have actionable file-import alternatives.

Tests use Chromium's synthetic media device to exercise the actual MediaStream API/canvas/Worker/IndexedDB path. That is not a claim of physical webcam testing or support for every permission UI/browser. The page-owned camera indicator is the browser's own indicator, not a fabricated privacy signal.

## Storage inspection

StorageManager inventories actual databases and browser storage estimates. Its cancellable, read-only scan checks project/class/active-version/feedback references, stored image hashes, full CSV dataset hashes and numeric model formats. It does not repair/delete, decode every image, prove model quality, verify old image hashes that were never stored, or authenticate imported metrics. Snapshots across separate databases are not a global transaction; avoid editing other tabs during a scan.

Metadata-only diagnostics include aggregate counts, byte/quota estimates, persistence state and integrity totals only. They exclude project names/IDs, paths/URLs, labels, raw rows/images, hashes, user agent, stacks, weights, encryption keys and deletion tokens. Diagnostics are not recoverable backups.

## Offline and jobs

The existing production service worker precaches emitted application/lazy/worker assets using a build revision. API/share responses are not cached. Image encoder packs retain their independent pinned size/hash verification. Shared activity locks prevent applying a waiting service-worker update while a tracked worker/training/backup job is active. Worker failure/cancel/timeout handlers terminate workers and release locks. Image normalization is bounded and has a 60-second timeout.

`pnpm dev` intentionally does not install a service worker. Build/production-preview and wait for installation before offline tests. Origin changes isolate browser data. HTTPS/localhost, correct JS MIME and compatible CSP are required. Browser cache/IndexedDB eviction remains possible; private full backups are essential.

## Local release gates

`pnpm release:check --browser` executes the environment/import-boundary checks, actual frontend/relay typechecks, unit/runtime tests, production builds, dependency audit and explicit implemented Playwright specs. It never deploys. The static import scan detects reachable planned stubs and Node/relay dependencies in the browser graph; it is not a complete AST/security audit. Unfinished scaffold test files are excluded explicitly rather than being counted as passing tests.

CI runs the same gate on Node 22.23.4/pnpm 9.15.5 with a reviewed frozen lockfile and installed Chromium. The scheduled security workflow audits dependencies without write permissions or deployment secrets. Local execution of these commands does not establish that hosted GitHub Actions has already run. Operator deployment workflows remain unfinished and must not be represented as automatic working deployment.

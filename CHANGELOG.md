# Changelog

All notable changes to NEURON. The project is built in phases; each phase is complete, tested and
pushed as a working slice — not a mockup. Anything not listed here does not exist yet.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). The project does not yet
declare a semantic version beyond the workspace version.

---

## [0.3.0] — Phase 3 · Encrypted model sharing

### Added
- In-browser AES-256-GCM encryption of a sanitized model artifact; the key never leaves the client.
- Cloudflare Worker relay (`services/relay`) with R2 object storage and a Durable Object rate limiter.
- `POST /api/shares`, `GET /api/shares/{id}`, `DELETE /api/shares/{id}`, `GET /api/shares/health`.
- Expiry choices of 15 minutes, 1 hour and 24 hours; hourly cron physically removes expired objects.
- Separate IndexedDB database for deletion receipts, so deleting a project does not lose revocation access.
- `Receive` and `Shares` pages, key-stripping from the visible address bar.
- `docs/sharing-protocol.md` — framing, API, limits and threat notes.
- 22 new tests (web + relay).

### Changed
- Workspace now requires **Node 22.12+** for the relay toolchain.
- `pnpm build` builds the web app *and* the worker bundle.

### Security
- Uploads are **disabled by default** in `wrangler.toml` (fail-closed).
- Origin allow-listing, application headers and per-IP/global budget checks on mutation routes.
- Root pnpm overrides pin Miniflare's `undici` and `sharp` to advisory-free versions.

---

## [0.2.0] — Phase 2 · Offline, backups, reviewed evolution

### Added
- Build-generated service worker that precaches all emitted assets, including lazy routes.
- Web Locks–guarded *Apply safe update* so training/download/backup jobs block updates.
- Verified offline encoder pack: five pinned MobileNet v2 files (~14 MB), SHA-256 + byte-size pins,
  streamed bounded download, cancel support, staging cache and a single-pointer commit.
- Full project backup/restore (images, classes, versions, feedback) with schema, shape, hash and JPEG
  validation before an atomic write; always restores into a new project.
- Consent-based feedback queue: approve → dataset, discard → delete; manual retraining only.
- Byte-level duplicate detection on ingest.
- Dataset and validation fingerprints recorded in training artifacts; comparison warnings when they differ.
- Additive IndexedDB migration from version 1 → 2 (existing data preserved).
- 22 new tests.

### Changed
- Training and dataset services now run inside cross-tab activity locks.
- Offline banner and updated runtime/backup settings panels.

---

## [0.1.0] — Phase 1 · Real on-device image classification

### Added
- Responsive dark navy / cyan / violet UI (hash router, 10 pages, accessible modal focus handling,
  visible focus rings, reduced-motion rules).
- Local projects in IndexedDB with deletion.
- Dataset builder: 2–20 classes, JPEG/PNG/WebP ingest, bounded JPEG normalization, per-class counts.
- Real TensorFlow.js transfer learning: frozen MobileNet v2 encoder (1,280 features) + trainable
  softmax head, WebGL preferred with CPU fallback and honest runtime reporting.
- Seeded stratified 20 % validation split, real epoch metrics, cancellation, confusion matrix.
- Immutable saved model versions with activate/rollback.
- Saved-file prediction and one-shot camera-frame prediction.
- Strictly validated `.neuron.json` export/import (tensor names and shapes checked; no arbitrary graphs).
- Storage estimates, persistence request, capability checks.
- 18 automated tests.

---

## Not yet built

Text, audio, video, tabular and custom modalities · WebRTC/P2P transfer · worker-isolated training ·
independent test-set UI · continuous camera streaming · resumable training · encrypted dataset backups ·
deployment automation · security, accessibility and device-matrix audits · a license.

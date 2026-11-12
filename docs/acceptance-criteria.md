# Cumulative acceptance criteria — Phase 6

## Required local checks

Use Node >=22.12 and pnpm 9.15.5 from repository root. Run `pnpm install` after applying the handoff and review/commit the regenerated lockfile. Then:

```
pnpm check:env
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
pnpm audit
pnpm --filter @neuron/web exec playwright install chromium
pnpm test:e2e
```

On Linux CI, install browser OS dependencies too: `pnpm --filter @neuron/web exec playwright install --with-deps chromium`. Alternatively use `pnpm release:check --browser` after installing browsers. `pnpm release:check` without `--browser` explicitly reports that its browser gate was skipped. A frozen install needs the updated committed lockfile; do not weaken CI by ignoring lock drift.

## Added Phase 5 acceptance gates

- The browser's rendered app imports no reachable planned stubs; app route parser does not accept nested/malformed project IDs or turn unknown routes into working pages.
- Skip navigation focuses main content while preserving the SPA hash route. Settings/project/CSV navigation renders at desktop/mobile sizes. Serious/critical automated axe checks run on the six named landing/settings pages, not the entire app or every dialog. Manual accessibility review is still required.
- Create/edit image project classes through the planned feature components. Concurrent class additions transact against current metadata. Missing classes, duplicate class names and stale image-training commits fail without saving a new active model.
- File import uses the actual image normalization Worker on supported Chromium, produces JPEG bounded to 768px, detects invalid source data and retains existing exact normalized-image duplicate checks. The fallback is capability-based, not silent error suppression.
- Camera opens only on explicit start, requests no audio, saves/predicts only an explicit frame, supports denial/cancel/late permission, stops on navigation/hidden/stop/preferences and does not issue a dataset upload. The automated device is synthetic; physical hardware is not certified.
- SampleGrid paginates all samples instead of making images after the first 120 inaccessible. Object URLs are revoked when thumbnails/previews unmount/change.
- Image training emits actual old metrics through the new Controls/Charts/Report modules. Inference uses one active engine, guards overlapping predictions and disposes stale engines. Feedback and existing encrypted sharing remain wired.
- Model export requires explicit local-download consent. Model import validates first and creates a new project; existing raw examples and models are not overwritten/deleted.
- Settings displays real inventory, quota and persistence results. The cancellable read-only scan detects injected stored checksum/reference errors without deleting records. Diagnostics contain only aggregate metadata and cannot restore a project.
- Camera and reduced-motion preferences synchronize same-origin tabs and survive reload where localStorage is allowed. Reset preferences does not reset databases/caches/receipts.

## Preserved cumulative gates

Phase 1–3 image training/inference/feedback/backup/restore and encrypted image-model relay tests must still pass. Phase 4 CSV classification/regression, grouped splits, train-only preprocessing, test evaluation, worker cancel, row/batch inference, model import/export and atomic backup restore must still work offline with an installed production shell. Image tests must install/verify the pinned encoder before disconnecting.

Run destructive/corruption scenarios only in isolated browser contexts/test databases, never on the user's real data. Do not clear site storage to conceal a failed migration/test. Do not remove tests, accept corrupt artifacts, replace real training with timers, or invent metrics to make gates pass.

## Phase 6 gates

- Text, real decoded WAV audio and real decoded VP8 video train in a module worker and classify unseen inputs through the browser UI.
- Microphone starts only explicitly, records usable audio and releases streams on stop/navigation. File import remains independent of capture.
- Custom validated affine JSON computes real predictions, persists, exports and rejects nonfinite/invalid shapes. No arbitrary graph support is claimed.
- Separate browser contexts exchange actual WebRTC signaling, transfer chunked checksummed model data and import only on explicit recipient action into a new project.
- Media full backups restore new IDs; corrupt checksums, feature mismatches, duplicate examples/classes and missing active models reject before any database commit.
- Production headers keep media/worker operation usable while enforcing CSP, nosniff, no-referrer and device permissions policy.

## Honest scope

See capability-matrix.md and phase6-audit.md. No deployment certification, independent hardware/browser fleet, universal network traversal, formal security/accessibility/fairness certification or guaranteed accuracy is claimed. Retired duplicate scaffold paths are listed in implementation-roadmap.md; their removal is not a claim that an unused file was implemented.

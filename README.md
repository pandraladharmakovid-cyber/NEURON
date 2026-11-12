# NEURON — Phase 6 integrated application
Local-first visual machine learning, with real browser training and prediction. This is the cumulative source release, not an instruction to rerun earlier phase generators.

## Run (Windows PowerShell or Linux)
Requires Node >=22.12 (tested 22.23.4), pnpm 9.15.5.
```
npx --yes pnpm@9.15.5 install --frozen-lockfile
npx --yes pnpm@9.15.5 release:check --browser
npx --yes pnpm@9.15.5 dev
```
Before the browser gate, install Chromium once: `npx --yes pnpm@9.15.5 --filter @neuron/web exec playwright install chromium` (Linux CI: add `--with-deps`). No API key or cloud training account is required. The image encoder is a separate explicit network download; text/audio/video/CSV/custom do not use remote weights.

## Workflows
- My projects: image datasets, explicit camera still capture, image encoder download, worker-trained classifier, evaluation, saved versions, inference, import/export and full backup.
- CSV studio: numeric/categorical preprocessing fitted to training data only, worker linear classification/regression, validation selection and held-out test evaluation, single/batch inference, model export and full backup.
- Media studio: create text/audio/video project with 2–20 labels, add representative examples, train, inspect held-out metrics, predict, activate saved versions, export model or full private backup. Audio accepts supported browser-decodable files and explicit microphone recording. Video uses uploaded clips, not live webcam video training.
- Custom models: import the documented finite affine JSON format, save locally and compute classification or regression predictions. Download the template to start. This is NOT ONNX/TensorFlow/PyTorch graph execution.
- Peer sharing: manual offer/answer exchange followed by an actual WebRTC data channel. Model-only transfer, checksummed and bounded; recipient reviews and explicitly imports into a new project. Optional ICE configuration remains in-session. No signaling service or connectivity guarantee.
- Settings: permissions, offline shell, local storage inventory, read-only integrity checks, private backups and explicit deletion. Export important data before clearing browser storage.

## Production / offline
`pnpm build`, then `pnpm --filter @neuron/web preview --host 0.0.0.0 --port 4173 --strictPort`. Use the same origin for persistent data. Wait for shell installation in Settings before disconnecting; image inference also needs the encoder pack. The development server intentionally does not install a service worker. Browser/device APIs require HTTPS or localhost. See docs/deployment.md; no deployment is performed by local release checks.

## Scope and honesty
These are bounded linear classifiers/regressors over fixed feature extractors, not foundation models or a universal AutoML engine. Test accuracy depends on representative examples. Synthetic test fixtures demonstrate execution, not production accuracy. See docs/capability-matrix.md and docs/phase6-audit.md for verified functionality, retired duplicate scaffolds and limits. Never run an older handoff over this source. Historical docs/handoffs are archival, not current requirements.

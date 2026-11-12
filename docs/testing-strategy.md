# Testing strategy
Unit tests exercise bounded parsers, actual algorithms, cryptographic format checks, IndexedDB repositories, transaction integrity, permissions and worker lifecycles. Relay tests exercise request validation, TTL/origin/rate/deletion behavior without deploying cloud resources.

Production Playwright tests exercise UI and actual module workers, normalization, persistence/import, microphone and camera lifecycle, text/audio/video training and unseen inference, custom affine computation and two-context WebRTC transfer. WAV is generated locally and video is recorded from canvas using MediaRecorder; decoding and extraction use real browser APIs. Fake hardware supplies repeatable capture input; physical-device coverage remains a manual release responsibility.

Run pnpm release:check --browser after installing Chromium. If an external production preview is used, set NEURON_E2E_BASE_URL to that origin. Otherwise Playwright manages its build/preview. Offline behavior must be checked against production, not Vite dev. Keep test profiles isolated from personal data. Store final executed results in phase6-audit.md; do not present historical failed runs as passing evidence.

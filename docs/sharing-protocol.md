# NEURON encrypted model sharing — protocol v1

Training remains local. Sharing is optional and online. It distributes the selected supported image classifier, never the project dataset. A trained model can still reveal sensitive information.

## Secrets and framing

The sender creates a fresh AES-256-GCM key and independent 256-bit deletion token using Web Crypto's CSPRNG. Ciphertext bytes are: ASCII NRN, version byte 1, 12-byte random IV, AES-GCM ciphertext with a 128-bit tag. Authenticated additional data is `NEURON-MODEL-SHARE:v1`. Payload is bounded UTF-8 JSON: format/version, model name and a whitelisted validated artifact. Unknown imported fields are stripped before encryption.

A relay POST receives ciphertext, SHA-256 of the deletion token and requested TTL. It generates a 192-bit random object reference. The encryption key NEVER enters the API request; it is in `/#/receive/{reference}/{key}`. URL fragments are not sent in HTTP requests. A recipient removes the incoming key from the visible address bar using replaceState and keeps it in memory; a refresh loses it. Preserve the original secret link to reopen.

The full link is a bearer capability. Anyone holding it can download/decrypt before expiry. The separate deletion token is stored locally in a receipt and sent only in the Authorization header on DELETE. No server-side decryption is possible through this protocol. The relay does not receive or store the decryption key. IP addresses, timing, ciphertext length and expiry are NOT hidden. Browser extensions, compromised client code and shared-link recipients are outside this encryption boundary.

## API (same-origin routing required)

- GET `/api/shares/health`: protocol/version and upload availability.
- POST `/api/shares`: binary body, `X-Neuron-Client: 1`, `X-Neuron-TTL`, `X-Neuron-Delete-Hash`. Returns reference and server expiry timestamp.
- GET `/api/shares/{id}`: bounded ciphertext; no deletion metadata returned.
- DELETE `/api/shares/{id}`: `Authorization: Bearer {deletion token}` and application header. Successful deletion returns 204.

All API responses are no-store. The service worker bypasses this prefix. Mutation requests must have an explicitly allowed browser Origin and application header. This is CSRF/origin hardening, NOT authentication against non-browser clients that can forge headers. No-account anonymous upload always requires abuse/billing oversight; do not call it abuse-proof.

Limits: encrypted envelope <=8 MB +64 bytes. Allowed TTLs: 60, 900, 3600, 86400 seconds; UI exposes 15 minutes/1 hour/24 hours. Download checks enforce expiry immediately; hourly cron physically removes expired objects even if never fetched. Provider backup/retention policy still applies. A scheduled delay does not grant post-expiry downloads through this API. Revocation cannot remove already-downloaded copies or plaintext exports.

A single transactional Durable Object enforces fixed-hour budgets: per-client upload 3, download 30, delete 20; global upload 50, download 500, delete 500. A salted hash of Cloudflare's connecting IP is used, not raw IP in application storage. The worker secret must be strong in production. Global budgets bound successful new client entries; NAT users share limits. These budgets do not cap every possible edge/R2/DO billing cost, and are not a replacement for provider rate controls, alerts and a kill switch. Failed reservations are not refunded to prevent retry abuse.

The server can validate envelope framing/size, NOT prove ciphertext decrypts to a model: it lacks the key. The official client encrypts only whitelisted model content. A malicious direct API client can upload arbitrary bytes disguised as an envelope; governance/abuse controls remain necessary. Expiry and deletion are capabilities, not account recovery.

Receipts live in a SEPARATE IndexedDB database so deleting a project does not lose revocation access automatically. They contain both link and deletion secret. Download them privately. Project backups deliberately omit them. Import receipts only into the same app origin. Forget local receipt is NOT revoke. Clearing browser data without exporting a receipt loses early-revocation access, while expiry remains enforced.

## Deployment

Worker implementation: `services/relay/src`; R2 binding SHARES; SQLite-backed Durable Object LIMITER; scheduled cron. `wrangler.toml` fails closed with uploads disabled. The bucket name is a real resource to provision, not a credential. Keep the R2 bucket private: never enable a public bucket endpoint that bypasses API expiry/deletion. Set exact production ALLOWED_ORIGINS; generate a >=32-character random RATE_SALT using the provider secret manager. Enable uploads only after setting billing alerts, edge rate controls, retention review and tests. Deploy via a reviewed Wrangler installation under Node 22.12+; no deployment is performed by local scripts.

Static frontend and API must share the browser origin. Route `/api/shares*` to the Worker at the provider; do not rely on Vite's development proxy in production. The existing public/\_headers needs host-specific application. Do not ship storage credentials or RATE_SALT in frontend/VITE variables. Do not log full links, fragments, Authorization headers or receipt JSON. Configure access logs and error monitoring accordingly. Cloudflare infrastructure may retain connection metadata independently.

Local Miniflare uses actual Worker/R2/DO runtime behavior but is NOT a public production deployment. It listens on 8787, with ciphertext state under services/relay/.local (gitignored). That state is development-only and may disappear in ephemeral sandboxes or manual cleanup. Web dev and production-preview proxies use server-only NEURON_RELAY_TARGET, default http://127.0.0.1:8787. Browser code always uses relative paths. Local dev allows localhost and HTTPS \*.e2b.app origins; production does not inherit that wildcard.

## Toolchain pins

The root pnpm overrides pin Miniflare’s transitive undici to 7.30.2 and sharp to 0.35.5, tested with this runtime. Earlier resolved versions had registry advisories. Keep these overrides and the generated lockfile; do not silently switch package managers or remove them. Advisory checks are point-in-time, not proof of security.
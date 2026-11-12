# Security headers
apps/web/public/_headers and root vercel.json carry the production policy; Vite preview reads the static header policy for local security regression. Enforce nosniff, no-referrer, camera/microphone self only, geolocation disabled and CSP restricting scripts/workers/media/model download destinations. CSP permits inline styles for the UI but not inline executable scripts. Verify actual CDN response headers after deployment.

Serve service-worker.js with no-cache; content-hashed assets may be immutable. Device permission also depends on HTTPS and browser/embedding policy; headers do not grant user permission. If adding encoder hosts or a relay, review the trust boundary rather than weakening CSP globally.

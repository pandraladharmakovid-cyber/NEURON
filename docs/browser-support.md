# Browser support
Automated release target: Playwright Chromium on Linux, including real browser decoding of synthetic WAV and VP8 clips, fake microphone/camera devices and two isolated WebRTC contexts. This is not independent hardware certification.

Requires modern module Workers, IndexedDB, Web Crypto, canvas and typed arrays. Microphone uses getUserMedia + MediaRecorder; video file decoding depends on installed codecs. Chromium WebM/VP8 and WAV have automated coverage. Safari/iOS/Firefox and other codecs require manual testing; no universal codec guarantee. A rejected device request leaves file ingestion usable. HTTPS (or localhost) is required for secure-context APIs.

Offline caches and storage may be evicted, private browsing can disable persistence, and memory constraints differ on phones. Different host/port/scheme is a different data origin. Use explicit backup/restore to move projects. P2P can fail on restrictive firewalls or symmetric NAT; operator-supplied TURN may be needed, with its own privacy/cost considerations.

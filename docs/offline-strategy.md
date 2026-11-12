# Offline strategy
Production Vite build emits a revisioned shell precache from generated assets, including module workers. Development deliberately does not install a worker. Install by opening the production origin online and waiting for Settings to report readiness. Keep one tab open through installation; reload to use the installed shell before testing network disconnection.

Text/audio/video/CSV/custom training or inference uses local code and browser APIs without remote model weights. Image feature extraction additionally needs the separately verified encoder pack. The shell is not proof that the encoder is installed. Relay links cannot upload/download offline; already imported models remain local. Manual P2P signaling and usable connectivity are separately required.

Do not delete caches automatically to resolve an update while private datasets are unsaved. Source/asset revision invalidation updates application code, not project databases. Revisit online after upgrades, export private data before browser reset, and distinguish network failures from missing codecs or memory exhaustion.

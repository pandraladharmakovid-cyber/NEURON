# Data lifecycle
Project data lives in origin-scoped IndexedDB. Image/CSV stores preserve their existing schemas; media uses neuron-multimodal v1 (projects/examples/versions), custom models use a separate store. Media raw text/audio/video is retained for training and explicit full backup. Trained artifacts retain feature/model/class information but are not anonymous.

Ingestion bounds source sizes, extracts real features and rejects duplicate hashes. Training snapshots the dataset; a changed source cannot silently activate stale media results. Version activation changes the active pointer, not the raw examples. Model import and backup restore create new projects/IDs. Full media restore verifies checksum, bounded features, class compatibility, duplicates and decoded-feature tolerance before a single transactional commit.

Deletion is explicit. Browser caches/encoder packs and share receipts are distinct from project backups. Sensitive link deletion capabilities are not included in dataset export. Browser-level clearing/eviction can permanently remove everything: keep private backups. Downloaded backups are unencrypted and are outside application deletion control.

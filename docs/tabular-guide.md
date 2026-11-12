# CSV studio — contracts and operational guide

## Data boundaries

Use UTF-8 CSV with a comma separator and a unique header row. Quoted commas, double-quote escapes, CRLF and quoted multiline cells are supported. Empty records are skipped. Ragged rows, duplicate/blank headers, trailing content after closing quotes and unclosed quotes fail with actionable messages. TSV, semicolon CSV, XLS/XLSX, ZIP and executable imports are not accepted. Source text is never evaluated as code or HTML.

The parser and training each have their own real module Worker. CSV parsing/structured-clone transfer and dataset persistence remain bounded operations, not a claim of zero-copy or unlimited memory. Source file <=16 MB; <=25,000 nonempty records, 100 columns, 500,000 cells, 4,096 chars/cell. Header <=100 chars. Use desktop Chrome/Edge as the initial target; smaller devices may require much smaller data. Cancel terminates a worker; interrupted jobs do not resume or activate partial weights.

## Targets and features

Choose task explicitly. Classification treats trimmed target strings as labels (2–20), with at least 10 distinct input-feature groups per label. Empty targets fail. Regression needs all numeric targets and at least 30 distinct feature groups. Numeric syntax uses dot decimals/scientific notation, finite magnitudes <=1e12. Dates, locale thousands separators and text require preparation before import. Column profiles are descriptive, not automatic semantic guarantees.

Pick 1–30 features, excluding target. Numeric preprocessing is fit only on train rows using Welford mean/std, missing-value mean imputation, standardization, clipping to +/-8 and a missing indicator. Invalid numeric strings become missing; inspect profiles before choosing types. A constant/all-missing numeric column uses std=1. Categorical features use at most 16 frequent nonempty levels <=128 chars; separate unseen/rare and missing buckets prevent collisions with actual literal strings. At most 512 encoded dimensions /2,000,000 total encoded matrix entries. Over-budget jobs fail before matrix allocation. There is no silent truncation of rows.

## Splits and learning

Seeded shuffle assigns distinct groups to train/validation/test approximately 70/15/15, stratified per class when classifying. Every exact selected-feature tuple stays in ONE split. Classification tuples with conflicting labels fail for correction. Regression repeated-feature records are kept in one split even with differing targets. This prevents exact-row leakage, not semantic duplicates, household/patient grouping, chronological leakage or target leakage. Remove identifiers and target-derived inputs yourself. Target normalization for regression is fit only on training targets.

The real engine is regularized softmax linear classification or regularized linear regression trained by mini-batch Adam, finite-value guards and gradient norm clipping. It yields each epoch inside a dedicated Worker. Best validation loss and configured patience select weights. The test split is evaluated only after that selection. No test metrics are used as gradients or early-stopping inputs. Artifact provenance records dataset/test fingerprints, split seed/counts and best epoch. Repeated human tuning against a reused test set still causes selection bias.

Reports: classification accuracy, macro F1, log loss and confusion matrix; regression MAE, RMSE and R-squared (null if target variance is zero). Softmax scores are relative outputs, not calibrated probabilities. A null R-squared is not replaced with a fabricated perfect score. Linear models cannot represent every problem; poor results are not fixed by inventing metrics.

## Persistence and concurrency

`neuron-tabular` IndexedDB v1 stores project metadata, the current CSV dataset, immutable model versions and active selection. Dataset replacement resets training configuration and preserves prior models. Commit checks that dataset/config have not changed since training; a stale result is not silently activated. Activation checks version ownership. Delete cascades only this tabular project's data/versions. Image `neuron-local` and sharing `neuron-sharing` databases are unchanged.

Snapshots use a single read transaction; backup restore validates all records before one atomic write transaction and always remaps IDs to a new project. Model-only import creates a new project with NO dataset. Training a received model again requires supplying data and choosing configuration. Browser quota/eviction/private mode remain failure risks. Keep exports outside the browser. These checks are not a general collaborative editing/conflict-merging system.

## Export safety and privacy

Supported `.neuron-tabular.json` contains only bounded, validated numeric linear weights, preprocessing and reports—never imported executable topology/scripts. It excludes raw training rows but may expose category names, statistics, labels and memorized information. Full `.neuron-tabular-backup.json` includes RAW CSV data and all versions, is not encrypted and needs explicit consent. Limits: 50 versions and a 64 MB backup. Model limit: 8 MB. Existing image full backups and image relay are separate formats and cannot pretend to handle tabular artifacts.

Single-row prediction tolerates missing fields via stored imputation/buckets. Batch CSV requires every model feature header, may include extra columns, and caps 5,000 rows per prediction export. Prediction CSV serialization quotes fields and prefixes formula-like STRING cells (including leading whitespace/control markers) with an apostrophe; finite numeric outputs remain numeric. This mitigates common spreadsheet formula injection; do not treat spreadsheet software as a trusted execution boundary. JSON backups are not spreadsheet exports.

## Offline and release gates

Vite production builds precache the emitted module Worker assets as well as lazy UI bundles. A new build must change the shell revision and be installed before going offline. CSV models need no encoder downloads. Do not cache API/share responses. Existing safe-update activity locks wrap worker parsing/training and backup processing. Closing a page cancels its worker; it does not delete already saved versions. Browser tests verify actual workers and offline behavior on the tested environment, not every hardware/browser. Deployment remains root-origin, HTTPS/localhost, correct JS MIME/CSP and provider-specific response headers.

Not included: arbitrary neural architectures, boosted trees, text embeddings, temporal/group-aware splitting beyond exact tuples, causal/fairness guarantees, a universal AutoML search, distributed datasets, SQL execution, automatic online uploads or tabular encrypted share links. Those require explicit implementation and validation rather than a working-looking button.

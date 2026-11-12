# Product requirements and completed scope
NEURON provides local dataset creation, real training, evaluation, inference, version selection and explicit transfer without an account. Image, CSV and text/audio/video are independent persisted project families. Custom affine inference is intentionally a constrained portable format, not arbitrary code execution.

User data must not be uploaded by dataset ingestion, training or prediction. Device access requires an explicit action and stops when its capture UI unmounts or permission preference changes. Exports distinguish model-only artifacts from sensitive full datasets. Imports validate before committing and create new IDs. No automatic clearing of user projects on upgrade.

Offline operation requires a completed production shell install; image encoder dependencies are explicitly downloaded/cached. A failed network, invalid import, permission rejection, stale training result or quota error must show actionable feedback, not fabricated results. Cloud deployment and external relay configuration are operator actions. Release evidence and residual limitations are recorded in phase6-audit.md.

import { useState } from "react";
import type { ModelArtifact } from "../../lib/types";
import { exportModel } from "../../lib/model-format";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { explainError } from "../../lib/errors";
export function ExportDialog({
  artifact,
  name,
  onClose,
}: {
  artifact: ModelArtifact;
  name: string;
  onClose: () => void;
}) {
  const [consent, setConsent] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title="Export a local image model" onClose={onClose}>
      <p>
        Downloads validated numeric classifier weights and metadata as JSON. No
        raw training images or deletion receipts are included. Feature weights
        and labels are not guaranteed anonymous.
      </p>
      <div className="export-summary">
        <div>
          <span>Encoder contract</span>
          <strong>
            {artifact.encoder} · {artifact.embeddingSize} features
          </strong>
        </div>
        <div>
          <span>Class count</span>
          <strong>{artifact.labels.length}</strong>
        </div>
        <div>
          <span>Validation rows</span>
          <strong>{artifact.evaluation.total}</strong>
        </div>
      </div>
      <p className="phase-note">
        A recipient needs this application and the verified image encoder pack.
        Exporting does not publish anything online. Use full project backups if
        you also need raw images.
      </p>
      <label className="privacy-toggle">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I approve downloading these model weights and class labels to this
        device.
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Button
        disabled={!consent}
        onClick={() => {
          try {
            exportModel(artifact, name);
            onClose();
          } catch (e) {
            setError(explainError(e).message);
          }
        }}
      >
        Download image model JSON
      </Button>
    </Dialog>
  );
}

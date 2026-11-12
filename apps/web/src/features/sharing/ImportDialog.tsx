import { useRef, useState } from "react";
import type { ModelArtifact } from "../../lib/types";
import { readModel } from "../../lib/model-format";
import { importReceived } from "./sharing.service";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { explainError } from "../../lib/errors";
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false);
  const [artifact, setArtifact] = useState<ModelArtifact | null>(null),
    [name, setName] = useState("Imported image model"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false);
  async function inspect(file: File) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setArtifact(null);
    setConsent(false);
    setError("");
    try {
      setArtifact(await readModel(file));
      setName(
        file.name.replace(/\.neuron\.json$|\.json$/i, "").slice(0, 64) ||
          "Imported image model",
      );
    } catch (e) {
      setError(explainError(e).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Import image model as a new project"
      onClose={() => !busy && onClose()}
    >
      <p>
        This validated model-only import creates a NEW image project. It never
        deletes another project's images, changes its labels or transfers
        share-deletion capabilities. Arbitrary TensorFlow graphs/scripts are
        rejected.
      </p>
      <input
        hidden
        ref={input}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void inspect(file);
        }}
      />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Choose image model file
      </Button>
      {artifact && (
        <div className="import-review">
          <h3>Validated image model</h3>
          <p>
            {artifact.labels.length} classes · {artifact.epochs.length} observed
            epochs · {artifact.evaluation.total} validation rows
          </p>
          <p className="phase-note">
            Reported metrics come from the model author and are not
            independently authenticated. No raw examples are present. Test the
            model on your own representative data.
          </p>
          <label className="field">
            Imported project name
            <input
              maxLength={64}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="privacy-toggle">
            <input
              type="checkbox"
              disabled={busy}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Import these weights and labels into a NEW local project.
          </label>
          <Button
            disabled={busy || !consent || !name.trim()}
            onClick={() => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              void importReceived({
                format: "neuron-shared-model",
                version: 1,
                name: name.trim(),
                artifact,
              })
                .then((p) => {
                  location.hash = "/projects/" + p.id + "/predict";
                  onClose();
                })
                .catch((e) => setError(explainError(e).message))
                .finally(() => {
                  lock.current = false;
                  setBusy(false);
                });
            }}
          >
            Import image model as new
          </Button>
        </div>
      )}
      {busy && <p role="status">Validating / importing model…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="phase-note">
        Maximum 8 MB. CSV artifacts use CSV studio's separate importer. A local
        image encoder pack is required for actual prediction.
      </p>
    </Dialog>
  );
}

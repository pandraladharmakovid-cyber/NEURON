import { useState } from "react";
import type { Version } from "../types";
import { activateVersion } from "../repository";
import { validateTabularModel } from "../model-format";
import { downloadBlob } from "../../lib/download";
import { Button } from "../../components/ui/Button";
import { message } from "../errors";
export function VersionPanel({
  versions,
  activeId,
  projectId,
  onActivated,
}: {
  versions: Version[];
  activeId?: string;
  projectId: string;
  onActivated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Saved CSV model versions</h2>
      <p>
        Activation uses each version’s original preprocessing and target. It
        does not overwrite the current CSV. Test scores from different
        dataset/split fingerprints should not be ranked as direct improvements.
      </p>
      {versions.map((v, i) => (
        <article className="csv-version" key={v.id}>
          <h3>
            Version {versions.length - i}
            {v.id === activeId ? " · Active" : ""} · {v.artifact.config.task}
          </h3>
          <p className="csv-note">
            {new Date(v.createdAt).toLocaleString()} ·{" "}
            {v.artifact.provenance.trainRows} train /{" "}
            {v.artifact.provenance.validationRows} validation /{" "}
            {v.artifact.provenance.testRows} test rows · Best epoch{" "}
            {v.artifact.provenance.bestEpoch}
          </p>
          <div className="csv-controls">
            <Button
              variant="secondary"
              disabled={busy || v.id === activeId}
              onClick={() => {
                setBusy(true);
                void activateVersion(projectId, v.id)
                  .then(onActivated)
                  .catch((e) => setError(message(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Activate / roll back
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  const safe = validateTabularModel(v.artifact);
                  downloadBlob(
                    new Blob([JSON.stringify(safe)], {
                      type: "application/json",
                    }),
                    `neuron-tabular-v${versions.length - i}.neuron-tabular.json`,
                  );
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              Export CSV model
            </Button>
          </div>
        </article>
      ))}
      {!versions.length && (
        <p className="muted">
          No saved CSV model yet. Train or import a supported CSV model.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="phase-note">
        CSV artifacts do not use the Phase 3 image-sharing relay. Export/import
        locally; raw rows are excluded from model-only export but category
        names/statistics can be sensitive.
      </p>
    </section>
  );
}

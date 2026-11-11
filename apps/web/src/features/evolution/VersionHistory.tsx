import { useState } from "react";
import { activateVersion } from "./evolution.service";
import { type ModelVersion, errorMessage } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { exportModel } from "../../lib/model-format";
export function VersionHistory({
  versions,
  activeId,
  projectId,
  onActivate,
}: {
  versions: ModelVersion[];
  activeId?: string;
  projectId: string;
  onActivate: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Saved model history</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Created</th>
              <th>Validation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v, i) => (
              <tr key={v.id}>
                <th scope="row">
                  {versions.length - i}
                  {v.id === activeId ? " · Active" : ""}
                </th>
                <td>{new Date(v.createdAt).toLocaleString()}</td>
                <td>
                  {(v.artifact.evaluation.accuracy * 100).toFixed(1)}% /{" "}
                  {v.artifact.evaluation.total} images
                </td>
                <td>
                  <div className="inline wrap">
                    <Button
                      variant="secondary"
                      disabled={busy || v.id === activeId}
                      onClick={() => {
                        setBusy(true);
                        void activateVersion(projectId, v.id)
                          .then(() => onActivate(v.id))
                          .catch((e) => setError(errorMessage(e)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      Activate / roll back
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        try {
                          exportModel(
                            v.artifact,
                            "neuron-v" + (versions.length - i),
                          );
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    >
                      Export
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!versions.length && <p className="muted">No versions saved yet.</p>}
    </section>
  );
}
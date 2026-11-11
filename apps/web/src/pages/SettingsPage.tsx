import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Upload, HardDrive } from "lucide-react";
import { storageInfo, bytes, capabilities } from "../lib/capabilities";
import { listProjects, importVersion } from "../lib/db";
import { readModel } from "../lib/model-format";
import { type Project, errorMessage, uid } from "../lib/types";
import { RuntimeSettings } from "../features/settings/RuntimeSettings";
import { BackupPanel } from "../features/settings/BackupPanel";
import { Button } from "../components/ui/Button";
export function SettingsPage() {
  const [storage, setStorage] = useState<Awaited<
      ReturnType<typeof storageInfo>
    > | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const support = capabilities();
  useEffect(() => {
    storageInfo()
      .then(setStorage)
      .catch((e) => setError(errorMessage(e)));
    listProjects()
      .then((p) => {
        setProjects(p);
        setSelected(p[0]?.id ?? "");
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const artifact = await readModel(file);
      const p = projects.find((p) => p.id === selected);
      if (!p) throw new Error("Create and select a project first.");
      if (
        !confirm(
          `Import this model into “${p.name}”? Its class vocabulary will be replaced and all its existing training images deleted. Existing saved model versions remain available. Export does not restore images.`,
        )
      )
        return;
      await importVersion(p, {
        id: uid(),
        projectId: p.id,
        artifact,
        createdAt: Date.now(),
      });
      setMessage("Model imported. Open this project’s Predict page to use it.");
      setProjects(await listProjects());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR RULES</div>
          <h1>Privacy & storage</h1>
          <p>Understand what stays here—and what needs a backup.</p>
        </div>
        <ShieldCheck className="accent-icon" size={36} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <section className="panel sharing-settings">
        <h2>Encrypted model sharing</h2>
        <p>
          Create expiring links from a saved model’s Predict page. An optional
          relay stores ciphertext—not your dataset. Keep the deletion receipt to
          revoke a link before expiry.
        </p>
        <a className="btn btn-secondary" href="#/shares">
          Manage encrypted links
        </a>
      </section>
      <div className="settings-grid">
        <RuntimeSettings />
        <BackupPanel />
        <section className="panel">
          <h2>
            <HardDrive size={20} /> Browser storage
          </h2>
          <div className="storage-number">
            {storage ? bytes(storage.usage) : "…"}
            <small> used by this origin</small>
          </div>
          <p className="muted">
            Estimated quota: {storage ? bytes(storage.quota) : "…"}. Browser
            estimates can change.
          </p>
          <p>
            Persistence:{" "}
            <strong>
              {storage?.persistent ? "Granted" : "Not guaranteed"}
            </strong>
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void (async () => {
                try {
                  const granted = await navigator.storage?.persist?.();
                  setMessage(
                    granted
                      ? "Persistent storage granted. Still keep backups."
                      : "Your browser did not grant persistence. Export important models.",
                  );
                  setStorage(await storageInfo());
                } catch (e) {
                  setError(errorMessage(e));
                }
              })()
            }
          >
            Request persistent storage
          </Button>
          <p className="phase-note">
            Clearing browser/site data deletes projects. Model exports do not
            include training images. Use the full project backup panel to export
            images and models together.
          </p>
        </section>
        <section className="panel">
          <h2>
            <Upload size={20} /> Import a model
          </h2>
          <p className="muted">
            Only validated NEURON image models exported by this phase. Maximum 8
            MB. Arbitrary TensorFlow graphs or scripts are not accepted.
          </p>
          <label className="field">
            Target project
            <select
              value={selected}
              disabled={busy}
              onChange={(e) => setSelected(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFile(file);
            }}
          />
          <Button
            variant="secondary"
            disabled={busy || !selected}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            {busy ? "Importing…" : "Choose model file"}
          </Button>
          {!projects.length && (
            <p>
              <a href="#/projects">Create a project first →</a>
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Device capabilities</h2>
          <dl className="summary-list">
            <div>
              <dt>IndexedDB</dt>
              <dd>{support.storage ? "Available" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Camera API</dt>
              <dd>{support.camera ? "Available" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Secure context</dt>
              <dd>{support.secure ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>WebGPU API</dt>
              <dd>{support.webgpu ? "Detected (not used)" : "Not detected"}</dd>
            </div>
          </dl>
          <p className="phase-note">
            This phase trains with WebGL or CPU—not WebGPU. Detection is not a
            certification of training performance.
          </p>
        </section>
        <section className="panel">
          <h2>The local-first promise</h2>
          <ul className="privacy-list">
            <li>No account or application backend for this workflow.</li>
            <li>No analytics or sample uploads.</li>
            <li>
              Encoder weights download from Google-hosted model endpoints.
            </li>
            <li>Exporting a model is an explicit user action.</li>
            <li>Private mode or storage eviction can remove local data.</li>
            <li>
              Offline reload requires an installed production shell and encoder
              pack. Encrypted links require the optional sharing relay; they do
              not work offline.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
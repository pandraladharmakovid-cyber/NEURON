import { trackTransaction } from "../../lib/db";
import { useEffect, useRef, useState } from "react";
import { listProjects, snapshotProject, database } from "../../lib/db";
import { encodeBackup, decodeBackup } from "../../lib/backup-format";
import { downloadBlob, safeFilename } from "../../lib/download";
import { runActivity } from "../../pwa/update-manager";
import { type Project, errorMessage } from "../../lib/types";
import { Button } from "../../components/ui/Button";
export async function restoreProject(file: Blob) {
  const snapshot = await decodeBackup(file);
  // Decode images before transaction; never keep IDB transactions alive across canvas work.
  for (const s of [...snapshot.samples, ...snapshot.feedback]) {
    const bitmap = await createImageBitmap(s.blob);
    try {
      if (bitmap.width > 768 || bitmap.height > 768)
        throw new Error("Backup image exceeds normalized dimensions.");
    } finally {
      bitmap.close();
    }
  }
  const db = await database(),
    tx = trackTransaction(
      db.transaction(
        ["projects", "samples", "versions", "feedback"],
        "readwrite",
      ),
    );
  await tx.objectStore("projects").add(snapshot.project);
  for (const s of snapshot.samples) await tx.objectStore("samples").add(s);
  for (const v of snapshot.versions) await tx.objectStore("versions").add(v);
  for (const f of snapshot.feedback) await tx.objectStore("feedback").add(f);
  await tx.done;
  return snapshot.project;
}
export function BackupPanel() {
  const [projects, setProjects] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    listProjects()
      .then((p) => {
        setProjects(p);
        setSelected(p[0]?.id ?? "");
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await runActivity(fn);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Full project backups</h2>
      <p>
        Includes your normalized images, feedback, class names and all model
        versions. This is a sensitive, unencrypted local file. Keep it somewhere
        private.
      </p>
      <label className="field">
        Project
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value)}
        >
          {projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I understand this backup contains my images and is not encrypted.
      </label>
      <div className="inline wrap">
        <Button
          variant="secondary"
          disabled={busy || !selected || !consent}
          onClick={() =>
            void task(async () => {
              const snapshot = await snapshotProject(selected);
              downloadBlob(
                await encodeBackup(snapshot),
                safeFilename(snapshot.project.name) + ".neuron-backup.json",
              );
              setMessage(
                "Backup downloaded. Keep original images separately too.",
              );
            })
          }
        >
          Download full backup
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Restore as new project
        </Button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (
            file &&
            confirm(
              "Restore this backup as a NEW local project? Existing projects will not be overwritten.",
            )
          )
            void task(async () => {
              const p = await restoreProject(file);
              setProjects(await listProjects());
              setSelected(p.id);
              setMessage("Restored successfully. Open My projects to use it.");
            });
        }}
      />
      {busy && <p role="status">Processing backup… keep this page open.</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <p className="phase-note">
        Limits: 1,000 samples, 100 feedback items, 50 model versions, 32 MB
        total images and 64 MB backup file. Images are checksum-checked and
        decoded before atomic restore. No source project is overwritten.
      </p>
    </section>
  );
}
import { useEffect, useRef, useState } from "react";
import { projects, snapshot } from "../repository";
import type { Project } from "../types";
import { encodeBackup, restoreBackup } from "../backup";
import { downloadBlob, safeFilename } from "../../lib/download";
import { runActivity } from "../../pwa/update-manager";
import { message } from "../errors";
import { Button } from "../../components/ui/Button";
export function TabularBackupPanel() {
  const [items, setItems] = useState<Project[]>([]),
    [selected, setSelected] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function refresh() {
    const p = await projects();
    setItems(p);
    setSelected((previous) =>
      p.some((x) => x.id === previous) ? previous : (p[0]?.id ?? ""),
    );
  }
  useEffect(() => {
    void refresh().catch((e) => setError(message(e)));
  }, []);
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await runActivity(fn);
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel csv-backup-panel">
      <h2>Full CSV project backups</h2>
      <p>
        This separate format includes RAW table rows, configuration and all CSV
        model versions. It is sensitive, unencrypted JSON. Image projects and
        deletion receipts are not included.
      </p>
      <label className="field">
        CSV backup project
        <select
          disabled={busy}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {items.map((p) => (
            <option key={p.id} value={p.id}>
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
        I understand the CSV backup contains my raw table data and is not
        encrypted.
      </label>
      <div className="csv-upload-actions">
        <Button
          variant="secondary"
          disabled={!consent || !selected || busy}
          onClick={() =>
            void task(async () => {
              const s = await snapshot(selected);
              downloadBlob(
                await encodeBackup(s),
                safeFilename(s.project.name) + ".neuron-tabular-backup.json",
              );
              setStatus("CSV backup downloaded. Keep it private.");
            })
          }
        >
          Download CSV project backup
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Restore CSV backup as new
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
              "Restore this CSV backup as a NEW project? Existing projects will not be overwritten.",
            )
          )
            void task(async () => {
              const p = await restoreBackup(file);
              setSelected(p.id);
              setStatus(
                "CSV project restored as new. Open CSV studio to use it.",
              );
            });
        }}
      />
      {busy && <p role="status">Processing CSV backup…</p>}
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="phase-note">
        Max 64 MB /50 versions. Full dataset hash and model formats are
        validated before atomic restore. Clearing browser data can still delete
        local projects.
      </p>
    </section>
  );
}

import { useRef, useState } from "react";
import { createProject } from "./project.service";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { explainError } from "../../lib/errors";
export function ProjectWizard({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    lock = useRef(false);
  return (
    <Dialog title="Create an image project" onClose={() => !busy && onClose()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError("");
          void createProject(name)
            .then((p) => {
              location.hash = "/projects/" + p.id;
            })
            .catch((e) => setError(explainError(e).message))
            .finally(() => {
              lock.current = false;
              setBusy(false);
            });
        }}
      >
        <label className="field">
          Project name
          <input
            autoFocus
            maxLength={64}
            required
            value={name}
            placeholder="e.g. My plant classifier"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className="muted">
          Start with two classes, add your images, then train on this device.
        </p>
        <div className="modality-tabs">
          <span className="current">Image projects</span>
          <a href="#/tabular">CSV / tabular projects →</a>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create project"}
        </Button>
      </form>
    </Dialog>
  );
}

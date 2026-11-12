import { useEffect, useRef, useState } from "react";
import {
  projects,
  createProject,
  deleteProject,
  importModel,
} from "../tabular/repository";
import type { Project } from "../tabular/types";
import { readTabularModel } from "../tabular/model-format";
import { message } from "../tabular/errors";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
export function TabularProjectsPage() {
  const [items, setItems] = useState<Project[]>([]),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  async function refresh() {
    try {
      setItems(await projects());
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CSV STUDIO / LOCAL-FIRST LEARNING</div>
          <h1>Your tables. Your models.</h1>
          <p>
            Real classification and regression, trained in local CPU workers. No
            account or cloud training.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>New CSV project</Button>
      </div>
      <div className="modality-tabs">
        <a href="#/projects">Image projects</a>
        <span className="current">CSV / tabular projects</span>
        <a href="#/settings">Private backups</a>
      </div>
      <div className="notice">
        This studio trains bounded linear models—not arbitrary AI architectures.
        Choose representative data and inspect held-out results. Your rows stay
        in this browser.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="csv-upload-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Import CSV model
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
          if (file)
            void task(async () => {
              const artifact = await readTabularModel(file);
              const project = await importModel(artifact);
              location.hash = "/tabular/" + project.id + "/predict";
            });
        }}
      />
      {loading ? (
        <p role="status">Loading CSV projects…</p>
      ) : items.length ? (
        <div className="project-grid">
          {items.map((p) => (
            <article className="project-card" key={p.id}>
              <span className="tag">CSV · {p.config?.task ?? "CONFIGURE"}</span>
              <a className="project-title" href={`#/tabular/${p.id}`}>
                {p.name} ↗
              </a>
              <p>
                {p.activeVersionId
                  ? "Saved model available"
                  : "Ready for your data"}
              </p>
              <div className="project-card-footer">
                <small>{new Date(p.updatedAt).toLocaleDateString()}</small>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Delete CSV project “${p.name}”, its dataset and model versions permanently?`,
                      )
                    )
                      void task(async () => {
                        await deleteProject(p.id);
                        await refresh();
                      });
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Give your table something to learn.</h2>
          <p>Create a CSV project or import a previously exported CSV model.</p>
        </div>
      )}
      {open && (
        <Dialog
          title="Create a CSV project"
          onClose={() => !busy && setOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                const p = await createProject(name);
                location.hash = "/tabular/" + p.id;
              });
            }}
          >
            <label className="field">
              CSV project name
              <input
                autoFocus
                required
                maxLength={64}
                value={name}
                placeholder="e.g. Equipment measurements"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || !name.trim()}>
              Create CSV project
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}

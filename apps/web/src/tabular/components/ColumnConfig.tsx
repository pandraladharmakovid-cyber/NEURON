import { useMemo, useState } from "react";
import type { Dataset, Configuration } from "../types";
import { profile } from "../profile";
import { initialConfiguration } from "../profile";
import { saveConfiguration } from "../repository";
import { TaskPicker } from "./TaskPicker";
import { Button } from "../../components/ui/Button";
import { message } from "../errors";
export function ColumnConfig({
  dataset,
  initial,
  onSaved,
}: {
  dataset: Dataset;
  initial: Configuration | null;
  onSaved: () => Promise<void>;
}) {
  const [config, setConfig] = useState<Configuration>(
      initial ?? initialConfiguration(dataset),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const columns = useMemo(() => profile(dataset), [dataset]);
  function update(next: Configuration) {
    setConfig(next);
    setSaved(false);
  }
  return (
    <section className="panel">
      <h2>Define the learning task</h2>
      <TaskPicker
        value={config.task}
        disabled={busy}
        onChange={(task) => update({ ...config, task })}
      />
      <label className="field csv-target">
        Target column
        <select
          value={config.target}
          disabled={busy}
          onChange={(e) =>
            update({
              ...config,
              target: e.target.value,
              features: config.features.filter(
                (f) => f.name !== e.target.value,
              ),
            })
          }
        >
          {dataset.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <p className="csv-note">
        Pick 1–30 features. Descriptive profiling is not a guarantee: review
        IDs, leakage, numeric parsing and category quality yourself.
      </p>
      <div className="table-scroll">
        <table className="column-config">
          <thead>
            <tr>
              <th>Use</th>
              <th>Column</th>
              <th>Interpret as</th>
              <th>Missing</th>
              <th>Numeric / nonempty</th>
              <th>Distinct</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const feature = config.features.find(
                  (f) => f.name === column.name,
                ),
                isTarget = column.name === config.target;
              return (
                <tr key={column.name}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Use ${column.name}`}
                      disabled={
                        busy ||
                        isTarget ||
                        (!feature && config.features.length >= 30)
                      }
                      checked={!!feature && !isTarget}
                      onChange={(e) =>
                        update({
                          ...config,
                          features: e.target.checked
                            ? [
                                ...config.features,
                                { name: column.name, kind: column.kind },
                              ]
                            : config.features.filter(
                                (f) => f.name !== column.name,
                              ),
                        })
                      }
                    />
                  </td>
                  <th scope="row">
                    {column.name}
                    {isTarget ? " · TARGET" : ""}
                    {(column.longValues > 0 ||
                      (column.distinct > 16 &&
                        column.kind === "categorical")) && (
                      <div className="csv-profile-warning">
                        Long/rare levels may group into unseen bucket.
                      </div>
                    )}
                  </th>
                  <td>
                    <select
                      aria-label={`Type for ${column.name}`}
                      disabled={busy || !feature || isTarget}
                      value={feature?.kind ?? column.kind}
                      onChange={(e) =>
                        update({
                          ...config,
                          features: config.features.map((f) =>
                            f.name === column.name
                              ? {
                                  ...f,
                                  kind: e.target.value as
                                    | "numeric"
                                    | "categorical",
                                }
                              : f,
                          ),
                        })
                      }
                    >
                      <option value="numeric">Numeric</option>
                      <option value="categorical">Categorical</option>
                    </select>
                  </td>
                  <td>{column.missing}</td>
                  <td>
                    {column.numeric} / {dataset.rows.length - column.missing}
                  </td>
                  <td>{column.distinct}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="csv-upload-actions">
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void saveConfiguration(dataset.projectId, dataset.hash, config)
              .then(onSaved)
              .then(() => setSaved(true))
              .catch((e) => setError(message(e)))
              .finally(() => setBusy(false));
          }}
        >
          Save task configuration
        </Button>
        {saved && <span role="status">Configuration saved.</span>}
      </div>
      <p className="phase-note">
        Exact duplicate feature groups stay in one split. This does not detect
        target-derived fields or correlated patient/household/time groups.
        Invalid numeric cells are treated as missing.
      </p>
    </section>
  );
}

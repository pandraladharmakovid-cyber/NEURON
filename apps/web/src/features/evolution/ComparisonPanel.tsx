import { useState } from "react";
import type { ModelVersion } from "../../lib/types";
import { comparable } from "./evolution.service";
export function ComparisonPanel({ versions }: { versions: ModelVersion[] }) {
  const [left, setLeft] = useState(versions[0]?.id ?? ""),
    [right, setRight] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const a = versions.find((v) => v.id === left),
    b = versions.find((v) => v.id === right);
  if (!a || !b)
    return (
      <section className="panel">
        <h2>Version comparison</h2>
        <p>Train and save a model to begin comparing versions.</p>
      </section>
    );
  return (
    <section className="panel">
      <h2>Version comparison</h2>
      <div className="comparison-selects">
        {[
          { name: "Version A", value: left, set: setLeft },
          { name: "Version B", value: right, set: setRight },
        ].map((field) => (
          <label className="field" key={field.name}>
            {field.name}
            <select
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
            >
              {versions.map((v, i) => (
                <option key={v.id} value={v.id}>
                  Version {versions.length - i} ·{" "}
                  {new Date(v.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="metric-grid">
        <div>
          <small>Version A validation</small>
          <strong>{(a.artifact.evaluation.accuracy * 100).toFixed(1)}%</strong>
          <small>{a.artifact.evaluation.total} held-out images</small>
        </div>
        <div>
          <small>Version B validation</small>
          <strong>{(b.artifact.evaluation.accuracy * 100).toFixed(1)}%</strong>
          <small>{b.artifact.evaluation.total} held-out images</small>
        </div>
      </div>
      {comparable(a, b) ? (
        <p className="success">
          Same held-out image hashes and label vocabulary. These validation
          scores share an evaluation set; they are still not an independent
          test.
        </p>
      ) : (
        <p className="notice">
          These versions do not have the same verified validation-set
          fingerprint (or use Phase 1 artifacts). Their accuracy difference is
          not a reliable improvement measurement. Compare on a common
          independent test set before making claims.
        </p>
      )}
    </section>
  );
}
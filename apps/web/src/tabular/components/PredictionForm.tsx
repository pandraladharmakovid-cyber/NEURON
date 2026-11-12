import { useEffect, useRef, useState } from "react";
import type { Artifact, Prediction } from "../types";
import { predictRow, requireBatchHeaders } from "../predict";
import { parseCSVFile, type Job } from "../worker-client";
import type { ParsedCSV } from "../types";
import { LIMITS } from "../limits";
import { assert, message, cancelled } from "../errors";
import { displayNumber } from "../numeric";
import { safeCSV } from "../csv";
import { downloadBlob } from "../../lib/download";
import { runActivity } from "../../pwa/update-manager";
import { Button } from "../../components/ui/Button";
export function PredictionForm({ artifact }: { artifact: Artifact }) {
  const [values, setValues] = useState<Record<string, string>>({}),
    [prediction, setPrediction] = useState<Prediction | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    job = useRef<Job<{ table: ParsedCSV; hash: string }> | null>(null),
    stop = useRef(false),
    lock = useRef(false);
  useEffect(
    () => () => {
      stop.current = true;
      job.current?.cancel();
    },
    [],
  );
  async function batch(file: File) {
    if (lock.current) return;
    lock.current = true;
    stop.current = false;
    setBusy(true);
    setError("");
    setStatus("Parsing prediction CSV…");
    try {
      await runActivity(async () => {
        job.current = parseCSVFile(file);
        const { table } = await job.current.result;
        assert(
          table.rows.length <= LIMITS.batchRows,
          "Batch predictions support at most 5,000 rows.",
        );
        requireBatchHeaders(artifact, table.headers);
        const rows: (string | number)[][] = [
          artifact.config.task === "classification"
            ? ["row", "prediction", ...artifact.labels.map((l) => "score:" + l)]
            : ["row", "prediction"],
        ];
        for (let i = 0; i < table.rows.length; i++) {
          if (stop.current) throw cancelled();
          const p = predictRow(
            artifact,
            Object.fromEntries(
              table.headers.map((h, j) => [h, table.rows[i][j]]),
            ),
          );
          rows.push(
            p.kind === "classification"
              ? [
                  i + 1,
                  p.label,
                  ...artifact.labels.map(
                    (l) => p.scores.find((s) => s.label === l)!.score,
                  ),
                ]
              : [i + 1, p.value],
          );
          if (i % 50 === 0) {
            setStatus(`Predicting row ${i + 1}/${table.rows.length}`);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        if (stop.current) throw cancelled();
        downloadBlob(
          new Blob([safeCSV(rows)], { type: "text/csv;charset=utf-8" }),
          "neuron-predictions.csv",
        );
        setStatus(
          `Exported ${table.rows.length} real predictions. Formula-like string cells are escaped.`,
        );
      });
    } catch (e) {
      setError(message(e));
    } finally {
      job.current = null;
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Predict with this model</h2>
      <p>
        Missing numeric inputs use stored training means; missing/unseen
        categories use separate buckets. No network calls are needed.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            setPrediction(predictRow(artifact, values));
          } catch (e) {
            setError(message(e));
          }
        }}
      >
        <div className="csv-field-grid">
          {artifact.config.features.map((f) => (
            <label className="field" key={f.name}>
              {f.name}
              <input
                value={values[f.name] ?? ""}
                maxLength={4096}
                inputMode={f.kind === "numeric" ? "decimal" : "text"}
                placeholder={
                  f.kind === "numeric"
                    ? "Number, or leave missing"
                    : "Category, or leave missing"
                }
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <Button type="submit">Predict row</Button>
      </form>
      {prediction && (
        <div className="csv-prediction" role="status">
          <small>Actual local prediction</small>
          <strong>
            {prediction.kind === "classification"
              ? prediction.label
              : displayNumber(prediction.value)}
          </strong>
          {prediction.kind === "classification" &&
            prediction.scores.map((s) => (
              <div className="csv-probability" key={s.label}>
                <span>{s.label}</span>
                <strong>{(s.score * 100).toFixed(2)}%</strong>
              </div>
            ))}
          <p className="csv-note">
            {prediction.kind === "classification"
              ? "Softmax outputs are not calibrated probabilities."
              : "Numeric output is in the original target units, not a confidence interval."}
          </p>
        </div>
      )}
      <hr />
      <h3>Batch CSV prediction</h3>
      <p className="csv-note">
        Requires every selected feature header. Extra columns are ignored. Up to
        5,000 rows. Export contains predictions/scores only, not source feature
        values.
      </p>
      <input
        ref={input}
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void batch(file);
        }}
      />
      <div className="csv-upload-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          Predict CSV & download results
        </Button>
        {busy && (
          <Button
            variant="danger"
            onClick={() => {
              stop.current = true;
              job.current?.cancel();
            }}
          >
            Cancel batch prediction
          </Button>
        )}
      </div>
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

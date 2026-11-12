import type { Artifact, Report } from "../types";
import { displayNumber } from "../numeric";
function ReportView({
  report,
  title,
  labels,
}: {
  report: Report;
  title: string;
  labels: string[];
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="csv-note">{report.rows} held-out rows.</p>
      <div className="csv-metric-grid">
        {(report.kind === "classification"
          ? [
              ["Accuracy", `${(report.accuracy * 100).toFixed(2)}%`],
              ["Macro F1", displayNumber(report.macroF1)],
              ["Log loss", displayNumber(report.logLoss)],
            ]
          : [
              ["MAE", displayNumber(report.mae)],
              ["RMSE", displayNumber(report.rmse)],
              [
                "R²",
                report.r2 === null
                  ? "Undefined (constant target)"
                  : displayNumber(report.r2),
              ],
            ]
        ).map(([name, value]) => (
          <div key={name}>
            <small>{name}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {report.kind === "classification" && (
        <div className="table-scroll">
          <table>
            <caption>
              Confusion matrix — actual rows / predicted columns
            </caption>
            <thead>
              <tr>
                <th scope="col">Actual / predicted</th>
                {labels.map((l) => (
                  <th key={l} scope="col">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.confusion.map((row, i) => (
                <tr key={labels[i]}>
                  <th scope="row">{labels[i]}</th>
                  {row.map((n, j) => (
                    <td className={i === j ? "diagonal" : ""} key={j}>
                      {n}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.kind === "classification" && (
        <div className="table-scroll">
          <table>
            <caption>
              Per-class performance derived from this confusion matrix
            </caption>
            <thead>
              <tr>
                <th>Label</th>
                <th>Support</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => {
                const tp = report.confusion[i][i],
                  support = report.confusion[i].reduce((a, b) => a + b, 0),
                  predicted = report.confusion.reduce(
                    (total, row) => total + row[i],
                    0,
                  ),
                  precision = predicted ? tp / predicted : 0,
                  recall = support ? tp / support : 0,
                  f1 =
                    precision + recall
                      ? (2 * precision * recall) / (precision + recall)
                      : 0;
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{support}</td>
                    <td>{displayNumber(precision)}</td>
                    <td>{displayNumber(recall)}</td>
                    <td>{displayNumber(f1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="csv-note">
            Zero-denominator precision, recall and F1 use zero, consistent with
            macro F1. Support is the actual held-out class count, not the
            training frequency.
          </p>
        </div>
      )}
    </section>
  );
}
export function EvaluationPanel({ artifact }: { artifact: Artifact }) {
  return (
    <div className="csv-layout">
      <section className="notice">
        Best epoch {artifact.provenance.bestEpoch} was selected on validation
        loss. Test metrics were computed only after that selection. Repeated
        human tuning on the same test set can still overfit it; this is not
        deployment certification.
      </section>
      <ReportView
        report={artifact.evaluation.test}
        labels={artifact.labels}
        title="Held-out test evaluation"
      />
      <ReportView
        report={artifact.evaluation.validation}
        labels={artifact.labels}
        title="Validation evaluation"
      />
      <section className="panel">
        <h2>Model provenance & preprocessing</h2>
        <p className="csv-note">
          These are the saved model’s original statistics, not statistics refit
          from prediction inputs or a replacement dataset. Fingerprints
          establish content identity, not authenticity or trust in an imported
          author’s metrics.
        </p>
        <dl className="summary-list">
          <div>
            <dt>Algorithm</dt>
            <dd>{artifact.algorithm}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{artifact.config.target}</dd>
          </div>
          <div>
            <dt>Encoded width</dt>
            <dd>{artifact.preprocessing.width}</dd>
          </div>
          <div>
            <dt>Split seed</dt>
            <dd>{artifact.provenance.seed}</dd>
          </div>
          <div>
            <dt>Train / validation / test rows</dt>
            <dd>
              {artifact.provenance.trainRows} /{" "}
              {artifact.provenance.validationRows} /{" "}
              {artifact.provenance.testRows}
            </dd>
          </div>
          <div>
            <dt>Observed / selected epochs</dt>
            <dd>
              {artifact.history.length} / {artifact.provenance.bestEpoch}
            </dd>
          </div>
        </dl>
        <details>
          <summary>Inspect dataset and test fingerprints</summary>
          <p className="csv-note">Dataset SHA-256</p>
          <code className="csv-fingerprint">
            {artifact.provenance.datasetHash}
          </code>
          <p className="csv-note">Test content / configuration SHA-256</p>
          <code className="csv-fingerprint">
            {artifact.provenance.testHash}
          </code>
        </details>
        <details>
          <summary>Inspect training-only preprocessing</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Kind</th>
                  <th>Stored train-only statistics</th>
                </tr>
              </thead>
              <tbody>
                {artifact.preprocessing.features.map((f) => (
                  <tr key={f.name}>
                    <th scope="row">{f.name}</th>
                    <td>{f.kind}</td>
                    <td>
                      {f.kind === "numeric"
                        ? `Mean ${displayNumber(f.mean)} · Std ${displayNumber(f.std)} · Clip ±${f.clip} · Missing indicator`
                        : f.levels.length
                          ? `${f.levels.length} known levels: ${f.levels.join(", ")} · plus unseen/missing buckets`
                          : "No known training levels · unseen/missing buckets only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}

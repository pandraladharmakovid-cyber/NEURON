import type { ModelArtifact } from "../../lib/types";
export function EvaluationReport({ result }: { result: ModelArtifact }) {
  return (
    <section className="panel evaluation">
      <h2>Validation confusion matrix</h2>
      <p className="muted">
        Rows: actual class. Columns: predicted class. This is validation
        performance, not a separate test set.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Actual / predicted</th>
              {result.labels.map((l) => (
                <th scope="col" key={l.id}>
                  {l.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.evaluation.matrix.map((row, i) => (
              <tr key={result.labels[i].id}>
                <th scope="row">{result.labels[i].name}</th>
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
    </section>
  );
}

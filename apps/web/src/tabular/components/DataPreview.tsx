import type { Dataset } from "../types";
export function DataPreview({ dataset }: { dataset: Dataset }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Dataset preview</h2>
        <span className="tag">LOCAL ONLY</span>
      </div>
      <div className="csv-summary">
        <div>
          <strong>{dataset.rows.length.toLocaleString()}</strong>
          <small>data rows</small>
        </div>
        <div>
          <strong>{dataset.headers.length}</strong>
          <small>columns</small>
        </div>
        <div>
          <strong>20</strong>
          <small>preview row limit</small>
        </div>
      </div>
      <p className="csv-note">
        {dataset.fileName} · Showing up to 20 rows. All {dataset.rows.length}{" "}
        rows remain available for splits; preview is not data truncation.
      </p>
      <div className="csv-preview">
        <table>
          <thead>
            <tr>
              {dataset.headers.map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.slice(0, 20).map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} title={cell}>
                    {cell || "—"}
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

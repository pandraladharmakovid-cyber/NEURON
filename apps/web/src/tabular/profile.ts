import type { ParsedCSV, FeatureKind } from "./types";
import { numberValue } from "./numeric";
export type ColumnProfile = {
  name: string;
  missing: number;
  numeric: number;
  distinct: number;
  kind: FeatureKind;
  min: number | null;
  max: number | null;
  longValues: number;
};
export function profile(table: ParsedCSV): ColumnProfile[] {
  return table.headers.map((name, index) => {
    let missing = 0,
      numeric = 0,
      min = Infinity,
      max = -Infinity,
      longValues = 0;
    const values = new Set<string>();
    for (const row of table.rows) {
      const s = row[index].trim();
      if (!s) {
        missing++;
        continue;
      }
      values.add(s);
      if (s.length > 128) longValues++;
      const n = numberValue(s);
      if (n !== null) {
        numeric++;
        min = Math.min(min, n);
        max = Math.max(max, n);
      }
    }
    return {
      name,
      missing,
      numeric,
      distinct: values.size,
      kind:
        numeric > 0 && numeric / (table.rows.length - missing) >= 0.95
          ? "numeric"
          : "categorical",
      min: numeric ? min : null,
      max: numeric ? max : null,
      longValues,
    };
  });
}

import type { Dataset, Configuration } from "./types";

export function initialConfiguration(table: ParsedCSV): Configuration {
  const target = table.headers[table.headers.length - 1],
    columns = profile(table);
  return {
    task: "classification",
    target,
    features: columns
      .filter((c) => c.name !== target)
      .slice(0, 30)
      .map((c) => ({ name: c.name, kind: c.kind })),
  };
}
export function datasetRecord(
  projectId: string,
  fileName: string,
  table: ParsedCSV,
  hash: string,
): Dataset {
  return {
    projectId,
    fileName: fileName.slice(0, 160),
    headers: table.headers,
    rows: table.rows,
    hash,
    createdAt: Date.now(),
  };
}
export function taskLabel(task: string) {
  return task === "classification" ? "Classification" : "Regression";
}

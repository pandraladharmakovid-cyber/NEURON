import type { Preprocessor, ParsedCSV } from "./types";
import { numberValue } from "./numeric";
export function vectorize(
  values: Record<string, string>,
  preprocessor: Preprocessor,
) {
  const out = new Float32Array(preprocessor.width);
  let offset = 0;
  for (const feature of preprocessor.features) {
    const raw = (
      Object.hasOwn(values, feature.name) ? values[feature.name] : ""
    ).trim();
    if (feature.kind === "numeric") {
      const n = numberValue(raw);
      out[offset] =
        n === null
          ? 0
          : Math.max(
              -feature.clip,
              Math.min(feature.clip, (n - feature.mean) / feature.std),
            );
      out[offset + 1] = n === null ? 1 : 0;
      offset += 2;
    } else {
      const index = raw ? feature.levels.indexOf(raw) : -1;
      out[
        offset +
          (raw
            ? index >= 0
              ? index
              : feature.levels.length
            : feature.levels.length + 1)
      ] = 1;
      offset += feature.levels.length + 2;
    }
  }
  return out;
}
export function encodeRows(table: ParsedCSV, preprocessor: Preprocessor) {
  return table.rows.map((row) =>
    vectorize(
      Object.fromEntries(table.headers.map((h, i) => [h, row[i]])),
      preprocessor,
    ),
  );
}

import type { ParsedCSV, Configuration, Preprocessor } from "./types";
import { moments, numberValue } from "./numeric";
import { LIMITS } from "./limits";
import { assert } from "./errors";
export function fitPreprocessor(
  table: ParsedCSV,
  config: Configuration,
  training: number[],
): Preprocessor {
  assert(training.length > 0, "No training rows.");
  let width = 0;
  const features = config.features.map((feature) => {
    const index = table.headers.indexOf(feature.name);
    if (feature.kind === "numeric") {
      const values = training
        .map((i) => numberValue(table.rows[i][index]))
        .filter((n): n is number => n !== null);
      const stats = moments(values);
      width += 2;
      return {
        kind: "numeric" as const,
        name: feature.name,
        ...stats,
        clip: 8 as const,
      };
    }
    const counts = new Map<string, number>();
    for (const i of training) {
      const s = table.rows[i][index].trim();
      if (s && s.length <= LIMITS.levelChars)
        counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const levels = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, LIMITS.levels)
      .map(([s]) => s);
    width += levels.length + 2;
    return { kind: "categorical" as const, name: feature.name, levels };
  });
  assert(
    width <= LIMITS.encoded,
    "Too many encoded features (maximum 512). Select fewer columns/categories.",
  );
  assert(
    width * table.rows.length <= LIMITS.matrix,
    "Encoded matrix exceeds 2,000,000 entries. Reduce rows or selected features.",
  );
  return { width, features };
}

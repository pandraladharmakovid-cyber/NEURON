import { it, expect } from "vitest";
import { fixture, config, regressionConfig } from "./fixtures";
import { splitRows } from "../../tabular/split";
it("keeps exact duplicate feature groups together, deterministic and exhaustive", async () => {
  const d = await fixture();
  d.rows.push([...d.rows[0]]);
  const s = splitRows(d, config, 42);
  expect(splitRows(d, config, 42)).toEqual(s);
  const all = [...s.train, ...s.validation, ...s.test];
  expect(new Set(all).size).toBe(d.rows.length);
  expect(s.train.length + s.validation.length + s.test.length).toBe(
    d.rows.length,
  );
  const partition = (i: number) =>
    Object.keys(s).find((k) => s[k as keyof typeof s].includes(i));
  expect(partition(0)).toBe(partition(160));
  for (const rows of Object.values(s))
    expect(new Set(rows.map((i) => d.rows[i][2])).size).toBe(2);
  expect(splitRows(d, config, 43)).not.toEqual(s);
});
it("rejects conflicting labels for duplicate features", async () => {
  const d = await fixture();
  d.rows.push([...d.rows[0].slice(0, 2), "warm"]);
  expect(() => splitRows(d, config, 42)).toThrow(/conflicting/);
});
it("rejects missing targets, too-small groups and nonnumeric regression targets", async () => {
  const d = await fixture();
  d.rows[0][2] = "";
  expect(() => splitRows(d, config, 42)).toThrow(/missing/);
  d.rows = d.rows.slice(1, 4);
  expect(() => splitRows(d, config, 42)).toThrow();
  const r = await fixture(true);
  r.rows[0][2] = "no";
  expect(() => splitRows(r, regressionConfig, 42)).toThrow(/finite/);
});

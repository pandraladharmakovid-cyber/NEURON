import { describe, it, expect } from "vitest";
import {
  splitIndices,
  evaluate,
  random,
} from "../features/training/training.service";
import {
  cleanName,
  validateLabels,
} from "../features/projects/project.service";
describe("stratified split", () => {
  it("is deterministic, disjoint and preserves every class", () => {
    const y = [...Array(10).fill(0), ...Array(15).fill(1)];
    const a = splitIndices(y, 42);
    expect(a).toEqual(splitIndices(y, 42));
    expect(a.validation).toHaveLength(5);
    expect(new Set([...a.train, ...a.validation]).size).toBe(25);
    expect(a.train.some((i) => a.validation.includes(i))).toBe(false);
    expect(new Set(a.validation.map((i) => y[i])).size).toBe(2);
  });
  it("rejects undersized classes", () =>
    expect(() => splitIndices([0, 0, 0, 0, 1, 1, 1, 1, 1], 42)).toThrow(
      "at least 5",
    ));
  it("creates repeatable random numbers", () => {
    const a = random(7),
      b = random(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
describe("evaluation", () => {
  it("computes actual confusion counts", () =>
    expect(evaluate([0, 0, 1, 1], [0, 1, 1, 1], 2)).toEqual({
      accuracy: 0.75,
      total: 4,
      matrix: [
        [1, 1],
        [0, 2],
      ],
    }));
  it("rejects invalid labels", () =>
    expect(() => evaluate([0], [2], 2)).toThrow());
  it("rejects empty data", () => expect(() => evaluate([], [], 2)).toThrow());
});
describe("project validation", () => {
  it("trims names", () => expect(cleanName("  Plants ")).toBe("Plants"));
  it("rejects whitespace", () => expect(() => cleanName(" ")).toThrow());
  it("rejects duplicate classes", () =>
    expect(() =>
      validateLabels([
        { id: "1", name: "Cat" },
        { id: "2", name: "cat" },
      ]),
    ).toThrow("unique"));
});
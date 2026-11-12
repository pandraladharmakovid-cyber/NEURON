import { describe, it, expect } from "vitest";
import { parseCSV, safeCSV } from "../../tabular/csv";
import { numberValue } from "../../tabular/numeric";
import { profile } from "../../tabular/profile";
describe("CSV parser and boundary handling", () => {
  it("parses BOM, CRLF, commas, escaped quotes and quoted line breaks", () => {
    expect(
      parseCSV('\ufeffa,b\r\n"one, two","a""b"\r\n"line\nnext",2\r\n'),
    ).toEqual({
      headers: ["a", "b"],
      rows: [
        ["one, two", 'a"b'],
        ["line\nnext", "2"],
      ],
    });
  });
  it.each([
    "a,A\n1,2",
    "a,b\n1",
    'a,b\n"unterminated,2',
    'a,b\n12"3,4',
    'a,b\n"one"x,2',
    "a,b\n",
  ])("rejects malformed CSV %s", (text) =>
    expect(() => parseCSV(text)).toThrow(),
  );
  it("rejects oversized cells and skips empty physical records", () => {
    expect(() => parseCSV("a,b\n" + "x".repeat(4097) + ",2")).toThrow();
    expect(parseCSV("a,b\n\n1,2\n,\n").rows).toHaveLength(1);
  });
  it("formula hardens strings but retains actual negative numeric outputs", () => {
    const csv = safeCSV([["=cmd", "  @SUM(A1)", -3, "normal"]]);
    expect(csv).toContain("'=cmd");
    expect(csv).toContain("'  @SUM");
    expect(csv).toContain('"-3"');
    expect(() => safeCSV([[Infinity]])).toThrow();
  });
  it.each(["", "0x10", "1,000", "NaN", "Infinity", "1e13"])(
    "does not coerce unsafe or missing numbers %s",
    (s) => expect(numberValue(s)).toBeNull(),
  );
  it("accepts decimal scientific notation and profiles missing cells", () => {
    expect(numberValue("-1.2e2")).toBe(-120);
    const p = profile(parseCSV("a,b\n1,yes\n,yes\n3,no"));
    expect(p[0].missing).toBe(1);
    expect(p[0].numeric).toBe(2);
  });
});

// A worker is mocked only to exercise client lifecycle failures. Browser checks
// separately run the real production worker scripts with networking disabled.
import { vi, afterEach } from "vitest";
import { parseCSVFile } from "../../tabular/worker-client";
import { activeJobs } from "../../pwa/update-manager";
class TestWorker {
  static latest: TestWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    TestWorker.latest = this;
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => vi.unstubAllGlobals());
it("terminates a cancelled parsing worker and releases the safe-update activity lock", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const job = parseCSVFile(new File(["a,b\n1,2"], "data.csv"));
  await vi.waitFor(() => expect(TestWorker.latest).toBeDefined());
  expect(activeJobs()).toBeGreaterThan(0);
  job.cancel();
  await expect(job.result).rejects.toThrow(/cancel/i);
  expect(TestWorker.latest.terminated).toBe(true);
  expect(activeJobs()).toBe(0);
});
it("handles worker runtime failure without leaving an active job or leaking a worker", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const previous = TestWorker.latest;
  const job = parseCSVFile(new File(["a,b\n1,2"], "data.csv"));
  await vi.waitFor(() => expect(TestWorker.latest).not.toBe(previous));
  TestWorker.latest.onerror?.();
  await expect(job.result).rejects.toThrow(/failed to load/);
  expect(TestWorker.latest.terminated).toBe(true);
  expect(activeJobs()).toBe(0);
});
it("rejects malformed worker results before exposing a dataset to persistence", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const previous = TestWorker.latest;
  const job = parseCSVFile(new File(["a,b\n1,2"], "data.csv"));
  await vi.waitFor(() => expect(TestWorker.latest).not.toBe(previous));
  TestWorker.latest.onmessage?.({
    data: { type: "result", value: { hash: "not-a-hash", table: {} } },
  });
  await expect(job.result).rejects.toThrow(/hash/);
  expect(TestWorker.latest.terminated).toBe(true);
  expect(activeJobs()).toBe(0);
});
it("rejects wrong extensions before allocating a worker", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const previous = TestWorker.latest;
  await expect(
    parseCSVFile(new File(["a,b\n1,2"], "workbook.xlsx")).result,
  ).rejects.toThrow(/csv file/i);
  expect(TestWorker.latest).toBe(previous);
  expect(activeJobs()).toBe(0);
});
it("allows cancellation before File.arrayBuffer finishes without constructing a worker", async () => {
  vi.stubGlobal("Worker", TestWorker);
  const previous = TestWorker.latest;
  const job = parseCSVFile(new File(["a,b\n1,2"], "data.csv"));
  job.cancel();
  await expect(job.result).rejects.toThrow(/cancel/i);
  expect(TestWorker.latest).toBe(previous);
  expect(activeJobs()).toBe(0);
});

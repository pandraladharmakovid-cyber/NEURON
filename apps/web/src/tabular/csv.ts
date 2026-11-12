import { LIMITS } from "./limits";
import { assert } from "./errors";
import { validateTable } from "./schema";
export function parseCSV(input: string) {
  assert(
    new TextEncoder().encode(input).length <= LIMITS.fileBytes,
    "CSV exceeds the 16 MB file limit.",
  );
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    started = false;
  function cell() {
    assert(
      field.length <= LIMITS.cellChars,
      "CSV cell exceeds 4,096 characters.",
    );
    row.push(field);
    assert(row.length <= LIMITS.columns, "CSV exceeds 100 columns.");
    field = "";
    closed = false;
    started = false;
  }
  function record() {
    cell();
    if (row.some((c) => c.trim() !== "")) {
      records.push(row);
      assert(records.length <= LIMITS.rows + 1, "CSV exceeds 25,000 rows.");
      assert(
        records.length * row.length <= LIMITS.cells + LIMITS.columns,
        "CSV exceeds the cell budget.",
      );
    }
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (closed) {
      if (c === ",") cell();
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        record();
      } else
        assert(
          c === " " || c === "\t",
          "Unexpected content after a closing CSV quote.",
        );
    } else if (c === '"') {
      assert(!started && field === "", "Quote inside an unquoted CSV cell.");
      quoted = true;
      started = true;
    } else if (c === ",") cell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record();
    } else {
      field += c;
      started = true;
    }
    assert(
      field.length <= LIMITS.cellChars,
      "CSV cell exceeds 4,096 characters.",
    );
  }
  assert(!quoted, "Unclosed quoted CSV cell.");
  if (row.length || field || closed || started) record();
  assert(records.length >= 2, "CSV needs a header and at least one data row.");
  return validateTable({
    headers: records[0].map((h) => h.trim()),
    rows: records.slice(1),
  });
}
export function safeCSV(rows: (string | number)[][]) {
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value);
            if (typeof value === "number")
              assert(
                Number.isFinite(value),
                "Cannot export non-finite prediction.",
              );
            else if (
              /^[\s\u0000-\u001f]*[=+\-@]/.test(s) ||
              /^[\t\r\n]/.test(s)
            )
              s = "'" + s;
            return '"' + s.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}

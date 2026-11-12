export class TabularError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TabularError";
  }
}
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TabularError(message);
}
export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected CSV studio error occurred.";
}
export function cancelled() {
  return new DOMException(
    "Job cancelled. No partial model was saved.",
    "AbortError",
  );
}

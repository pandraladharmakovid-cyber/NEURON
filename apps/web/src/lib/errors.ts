export type FailureCode =
  | "cancelled"
  | "permission"
  | "quota"
  | "storage"
  | "invalid"
  | "unexpected";
export type Failure = {
  code: FailureCode;
  message: string;
  retryable: boolean;
};
export function explainError(error: unknown): Failure {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  const detail =
    error instanceof Error
      ? error.message
      : "The operation failed. Retry or export a backup before changing browser settings.";
  if (name === "AbortError")
    return {
      code: "cancelled",
      message: "Operation cancelled. Previously saved data is unchanged.",
      retryable: true,
    };
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      code: "permission",
      message:
        "Camera access was blocked. Use HTTPS/localhost, allow this site in browser permissions, or import a file instead.",
      retryable: true,
    };
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return {
      code: "permission",
      message:
        "No camera was found. Connect a camera or import image files instead.",
      retryable: true,
    };
  if (name === "NotReadableError" || name === "TrackStartError")
    return {
      code: "permission",
      message:
        "The camera is busy or unavailable. Close other camera apps and retry, or import a file.",
      retryable: true,
    };
  if (name === "QuotaExceededError")
    return {
      code: "quota",
      message:
        "Browser storage is full. Export private backups, then delete unneeded projects. Do not clear site data before backing up.",
      retryable: false,
    };
  if (name === "InvalidStateError" || name === "VersionError")
    return {
      code: "storage",
      message:
        "Browser storage is unavailable or an older tab is open. Close other NEURON tabs and reopen. Keep backups; do not reset storage blindly.",
      retryable: true,
    };
  return {
    code: "unexpected",
    message: detail.slice(0, 2000),
    retryable: true,
  };
}
export function cancelled(message = "Operation cancelled.") {
  return new DOMException(message, "AbortError");
}
export function requireCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

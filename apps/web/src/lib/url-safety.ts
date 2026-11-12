import { requireCondition } from "./errors";
export function safeExternalURL(value: string) {
  const u = new URL(value);
  requireCondition(
    u.protocol === "https:" && !u.username && !u.password,
    "Only HTTPS URLs without credentials are allowed.",
  );
  return u.href;
}
export function safeLocalRoute(value: string) {
  requireCondition(
    value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[\\\u0000-\u0020?#]/.test(value),
    "Invalid internal route.",
  );
  return "#" + value;
}
export function projectRoute(
  id: string,
  step?: "train" | "predict" | "evolve",
) {
  requireCondition(
    /^[A-Za-z0-9_-]{1,100}$/.test(id),
    "Invalid project identifier.",
  );
  return safeLocalRoute("/projects/" + id + (step ? "/" + step : ""));
}
export function downloadName(name: string, extension: string) {
  requireCondition(
    /^\.[a-z0-9.-]+$/i.test(extension),
    "Invalid download extension.",
  );
  return (
    (name.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || "neuron") + extension
  );
}

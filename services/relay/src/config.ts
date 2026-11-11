export interface Env {
  SHARES: R2Bucket;
  LIMITER: DurableObjectNamespace;
  ENVIRONMENT: string;
  ENABLE_UPLOADS: string;
  ALLOWED_ORIGINS: string;
  RATE_SALT: string;
}
export const MAX_BYTES = 8 * 1024 * 1024 + 64;
export const TTL_VALUES = [60, 900, 3600, 86400];
export function allowedOrigin(origin: string | null, env: Env) {
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  if (
    env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(origin)
  )
    return true;
  return (
    env.ENVIRONMENT === "development" &&
    ((["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      parsed.protocol === "http:") ||
      (parsed.hostname.endsWith(".e2b.app") && parsed.protocol === "https:"))
  );
}
export function checkProduction(env: Env) {
  if (
    env.ENVIRONMENT !== "development" &&
    (!env.RATE_SALT || env.RATE_SALT.length < 32)
  )
    throw new HttpError(
      503,
      "Relay operator must configure a strong RATE_SALT secret.",
    );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function secure(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(response.body, { status: response.status, headers });
}
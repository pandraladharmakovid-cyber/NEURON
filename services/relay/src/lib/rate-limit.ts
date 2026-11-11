import { type Env, HttpError } from "../config";
import { hashToken } from "./validation";
export async function reserve(
  env: Env,
  request: Request,
  action: "upload" | "download" | "delete",
) {
  // Cloudflare supplies CF-Connecting-IP at the edge. Do not trust client-supplied
  // forwarding headers on an unrelated production Node reverse proxy.
  const ip = request.headers.get("CF-Connecting-IP") || "local-development";
  const client = await hashToken(env.RATE_SALT + "|" + ip);
  const stub = env.LIMITER.get(
    env.LIMITER.idFromName("neuron-global-budget-v1"),
  );
  const response = await stub.fetch("https://budget.internal/reserve", {
    method: "POST",
    body: JSON.stringify({ client, action }),
  });
  if (response.status === 429)
    throw new HttpError(
      429,
      "Sharing rate limit reached. Retry after the hourly window resets.",
    );
  if (!response.ok)
    throw new HttpError(503, "Sharing budget service unavailable.");
}
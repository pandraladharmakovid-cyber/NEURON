import {
  type Env,
  HttpError,
  MAX_BYTES,
  allowedOrigin,
  checkProduction,
} from "./config";
import {
  validId,
  ttlValue,
  deletionHash,
  deletionToken,
  randomId,
  readCiphertext,
} from "./lib/validation";
import { storeCipher, fetchCipher, removeCipher } from "./lib/object-store";
import { reserve } from "./lib/rate-limit";
export async function route(request: Request, env: Env) {
  const url = new URL(request.url),
    base = "/api/shares";
  if (url.search)
    throw new HttpError(400, "Query parameters are not supported.");
  if (url.pathname === base + "/health" && request.method === "GET")
    return Response.json({
      service: "neuron-encrypted-relay",
      version: 1,
      uploadsEnabled: env.ENABLE_UPLOADS === "true",
      maxBytes: MAX_BYTES,
      maxTtlSeconds: 86400,
    });
  if (!url.pathname.startsWith(base)) throw new HttpError(404, "Not found.");
  checkProduction(env);
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(origin, env))
    throw new HttpError(403, "Application origin is not allowed.");
  if (request.method === "POST" || request.method === "DELETE") {
    if (
      !allowedOrigin(origin, env) ||
      request.headers.get("X-Neuron-Client") !== "1"
    )
      throw new HttpError(403, "Same-origin application request required.");
  }
  if (url.pathname === base && request.method === "POST") {
    if (env.ENABLE_UPLOADS !== "true")
      throw new HttpError(503, "Relay uploads are disabled by the operator.");
    const ttl = ttlValue(request.headers.get("X-Neuron-TTL")),
      hash = deletionHash(request.headers.get("X-Neuron-Delete-Hash"));
    await reserve(env, request, "upload");
    const bytes = await readCiphertext(request),
      id = randomId(),
      expiresAt = Date.now() + ttl * 1000;
    await storeCipher(env, id, bytes, hash, expiresAt);
    return Response.json({ id, expiresAt }, { status: 201 });
  }
  const match = url.pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{32})$/);
  if (!match || !validId(match[1]))
    throw new HttpError(404, "Share route not found.");
  const id = match[1];
  if (request.method === "GET") {
    await reserve(env, request, "download");
    return fetchCipher(env, id);
  }
  if (request.method === "DELETE") {
    const token = deletionToken(request);
    await reserve(env, request, "delete");
    await removeCipher(env, id, token);
    return new Response(null, { status: 204 });
  }
  throw new HttpError(405, "Method not allowed.");
}
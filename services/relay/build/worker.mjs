// src/config.ts
var MAX_BYTES = 8 * 1024 * 1024 + 64;
var TTL_VALUES = [60, 900, 3600, 86400];
function allowedOrigin(origin, env) {
  if (!origin) return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin) return false;
  if (env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean).includes(origin))
    return true;
  return env.ENVIRONMENT === "development" && (["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.protocol === "http:" || parsed.hostname.endsWith(".e2b.app") && parsed.protocol === "https:");
}
function checkProduction(env) {
  if (env.ENVIRONMENT !== "development" && (!env.RATE_SALT || env.RATE_SALT.length < 32))
    throw new HttpError(
      503,
      "Relay operator must configure a strong RATE_SALT secret."
    );
}
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function secure(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(response.body, { status: response.status, headers });
}

// src/lib/validation.ts
var validId = (s) => /^[A-Za-z0-9_-]{32}$/.test(s);
function ttlValue(value) {
  if (!value || !/^\d+$/.test(value) || !TTL_VALUES.includes(Number(value)))
    throw new HttpError(400, "Unsupported link lifetime.");
  return Number(value);
}
function deletionHash(value) {
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new HttpError(400, "Invalid deletion capability hash.");
  return value;
}
function deletionToken(request) {
  const match = request.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) throw new HttpError(401, "Deletion capability required.");
  return match[1];
}
async function hashToken(value) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(
    new Uint8Array(hash),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");
}
function constantEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function randomId() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))
  ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function readCiphertext(request) {
  const type = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/octet-stream")
    throw new HttpError(415, "Only encrypted binary envelopes are accepted.");
  const declared = request.headers.get("Content-Length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
    throw new HttpError(413, "Encrypted model exceeds the size limit.");
  if (!request.body) throw new HttpError(400, "Missing encrypted envelope.");
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Encrypted model exceeds the size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    output.set(c, offset);
    offset += c.length;
  }
  if (output.length < 33 || output[0] !== 78 || output[1] !== 82 || output[2] !== 78 || output[3] !== 1)
    throw new HttpError(400, "Invalid encrypted-envelope header.");
  return output;
}

// src/lib/object-store.ts
var objectKey = (id) => "share/" + id;
async function storeCipher(env, id, bytes, deleteHash, expiresAt) {
  await env.SHARES.put(objectKey(id), bytes, {
    customMetadata: { deleteHash, expiresAt: String(expiresAt) },
    httpMetadata: { contentType: "application/octet-stream" }
  });
}
async function fetchCipher(env, id) {
  const object = await env.SHARES.get(objectKey(id));
  if (!object) throw new HttpError(404, "Share not found or already removed.");
  const expiry = Number(object.customMetadata?.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    await env.SHARES.delete(object.key);
    throw new HttpError(410, "Expired share.");
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(object.size),
      "Content-Disposition": 'attachment; filename="neuron-model.enc"',
      "X-Neuron-Expires-At": String(expiry)
    }
  });
}
async function removeCipher(env, id, token) {
  const object = await env.SHARES.head(objectKey(id));
  if (!object) throw new HttpError(404, "Share not found or already removed.");
  if (!constantEqual(
    await hashToken(token),
    object.customMetadata?.deleteHash ?? ""
  ))
    throw new HttpError(403, "Incorrect deletion capability.");
  await env.SHARES.delete(object.key);
}
async function purgeExpired(env) {
  let cursor;
  let deleted = 0;
  do {
    const page = await env.SHARES.list({
      prefix: "share/",
      cursor,
      limit: 200,
      include: ["customMetadata"]
    });
    const expired = page.objects.filter(
      (o) => !Number.isFinite(Number(o.customMetadata?.expiresAt)) || Number(o.customMetadata?.expiresAt) <= Date.now()
    ).map((o) => o.key);
    if (expired.length) {
      await env.SHARES.delete(expired);
      deleted += expired.length;
    }
    cursor = page.truncated ? page.cursor : void 0;
  } while (cursor);
  return deleted;
}

// src/lib/rate-limit.ts
async function reserve(env, request, action) {
  const ip = request.headers.get("CF-Connecting-IP") || "local-development";
  const client = await hashToken(env.RATE_SALT + "|" + ip);
  const stub = env.LIMITER.get(
    env.LIMITER.idFromName("neuron-global-budget-v1")
  );
  const response = await stub.fetch("https://budget.internal/reserve", {
    method: "POST",
    body: JSON.stringify({ client, action })
  });
  if (response.status === 429)
    throw new HttpError(
      429,
      "Sharing rate limit reached. Retry after the hourly window resets."
    );
  if (!response.ok)
    throw new HttpError(503, "Sharing budget service unavailable.");
}

// src/router.ts
async function route(request, env) {
  const url = new URL(request.url), base = "/api/shares";
  if (url.search)
    throw new HttpError(400, "Query parameters are not supported.");
  if (url.pathname === base + "/health" && request.method === "GET")
    return Response.json({
      service: "neuron-encrypted-relay",
      version: 1,
      uploadsEnabled: env.ENABLE_UPLOADS === "true",
      maxBytes: MAX_BYTES,
      maxTtlSeconds: 86400
    });
  if (!url.pathname.startsWith(base)) throw new HttpError(404, "Not found.");
  checkProduction(env);
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigin(origin, env))
    throw new HttpError(403, "Application origin is not allowed.");
  if (request.method === "POST" || request.method === "DELETE") {
    if (!allowedOrigin(origin, env) || request.headers.get("X-Neuron-Client") !== "1")
      throw new HttpError(403, "Same-origin application request required.");
  }
  if (url.pathname === base && request.method === "POST") {
    if (env.ENABLE_UPLOADS !== "true")
      throw new HttpError(503, "Relay uploads are disabled by the operator.");
    const ttl = ttlValue(request.headers.get("X-Neuron-TTL")), hash = deletionHash(request.headers.get("X-Neuron-Delete-Hash"));
    await reserve(env, request, "upload");
    const bytes = await readCiphertext(request), id2 = randomId(), expiresAt = Date.now() + ttl * 1e3;
    await storeCipher(env, id2, bytes, hash, expiresAt);
    return Response.json({ id: id2, expiresAt }, { status: 201 });
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

// src/durable-objects/RateLimiter.ts
var empty = () => ({ upload: 0, download: 0, delete: 0 });
var PER_CLIENT = { upload: 3, download: 30, delete: 20 };
var GLOBAL = { upload: 50, download: 500, delete: 500 };
var RateLimiter = class {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    let input;
    try {
      input = await request.json();
    } catch {
      return new Response("Invalid budget request", { status: 400 });
    }
    const action = input.action, client = input.client;
    if (!action || !["upload", "download", "delete"].includes(action) || !client || !/^[a-f0-9]{64}$/.test(client))
      return new Response("Invalid budget request", { status: 400 });
    const allowed = await this.state.storage.transaction(async (tx) => {
      const hour = Math.floor(Date.now() / 36e5);
      let budget = await tx.get("budget");
      if (!budget || budget.hour !== hour)
        budget = { hour, global: empty(), clients: {} };
      if (budget.global[action] >= GLOBAL[action]) return false;
      const personal = budget.clients[client] ?? empty();
      if (personal[action] >= PER_CLIENT[action]) return false;
      budget.global[action]++;
      personal[action]++;
      budget.clients[client] = personal;
      await tx.put("budget", budget);
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
};

// src/index.ts
var index_default = {
  async fetch(request, env) {
    try {
      return secure(await route(request, env));
    } catch (e) {
      const known = e instanceof HttpError;
      return secure(
        Response.json(
          { error: known ? e.message : "Relay operation failed. Retry later." },
          {
            status: known ? e.status : 503,
            headers: known && e.status === 429 ? { "Retry-After": "3600" } : {}
          }
        )
      );
    }
  },
  async scheduled(_event, env, context) {
    context.waitUntil(purgeExpired(env));
  }
};
export {
  RateLimiter,
  index_default as default
};

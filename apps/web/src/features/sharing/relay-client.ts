import { MAX_CIPHER_BYTES } from "./crypto";
import { validShareId } from "./share-links";
export type RelayHealth = {
  service: "neuron-encrypted-relay";
  version: 1;
  uploadsEnabled: boolean;
  maxBytes: number;
  maxTtlSeconds: number;
};
async function bounded(response: Response, limit: number) {
  if (!response.body) throw new Error("Relay returned an empty response.");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Relay response exceeds the safety limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let i = 0;
  for (const chunk of chunks) {
    result.set(chunk, i);
    i += chunk.length;
  }
  return result;
}
async function request(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/shares" + path, {
      ...options,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    });
  } catch (e) {
    if (signal?.aborted)
      throw new DOMException("Sharing cancelled.", "AbortError");
    throw new Error(
      "Sharing relay is unreachable. Start pnpm dev:relay or configure a same-origin /api/shares route. " +
        (e instanceof Error ? e.message : ""),
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const data = JSON.parse(
        new TextDecoder().decode(await bounded(response, 8192)),
      );
      if (typeof data.error === "string") detail = data.error.slice(0, 300);
    } catch {
      /* never display untrusted HTML */
    }
    throw new Error(
      `Relay ${response.status}: ${detail || (response.status >= 500 ? "Sharing relay unavailable. Start pnpm dev:relay or check same-origin routing." : "request failed")}`,
    );
  }
  return response;
}
export async function relayHealth(signal?: AbortSignal): Promise<RelayHealth> {
  const data = JSON.parse(
    new TextDecoder().decode(
      await bounded(await request("/health", {}, signal), 8192),
    ),
  );
  if (
    data.service !== "neuron-encrypted-relay" ||
    data.version !== 1 ||
    typeof data.uploadsEnabled !== "boolean" ||
    !Number.isInteger(data.maxBytes) ||
    !Number.isInteger(data.maxTtlSeconds)
  )
    throw new Error("Incompatible sharing relay.");
  return data;
}
export async function uploadEncrypted(
  bytes: Uint8Array,
  deleteHash: string,
  ttl: number,
  signal: AbortSignal,
) {
  if (
    bytes.length > MAX_CIPHER_BYTES ||
    !/^[a-f0-9]{64}$/.test(deleteHash) ||
    ![60, 900, 3600, 86400].includes(ttl)
  )
    throw new Error("Invalid upload parameters.");
  const response = await request(
    "",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Neuron-Client": "1",
        "X-Neuron-Delete-Hash": deleteHash,
        "X-Neuron-TTL": String(ttl),
      },
      body: bytes as BodyInit,
    },
    signal,
  );
  const result = JSON.parse(
    new TextDecoder().decode(await bounded(response, 8192)),
  );
  if (
    !validShareId(result.id ?? "") ||
    !Number.isFinite(result.expiresAt) ||
    result.expiresAt <= 0
  )
    throw new Error("Relay returned invalid share metadata.");
  return result as { id: string; expiresAt: number };
}
export async function downloadEncrypted(id: string, signal: AbortSignal) {
  if (!validShareId(id)) throw new Error("Invalid share reference.");
  return bounded(await request("/" + id, {}, signal), MAX_CIPHER_BYTES);
}
export async function revokeEncrypted(
  id: string,
  token: string,
  signal?: AbortSignal,
) {
  if (!validShareId(id) || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Invalid deletion capability.");
  await request(
    "/" + id,
    {
      method: "DELETE",
      headers: { "X-Neuron-Client": "1", Authorization: "Bearer " + token },
    },
    signal,
  );
}
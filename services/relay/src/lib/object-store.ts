import { type Env, HttpError } from "../config";
import { constantEqual, hashToken } from "./validation";
const objectKey = (id: string) => "share/" + id;
export async function storeCipher(
  env: Env,
  id: string,
  bytes: Uint8Array,
  deleteHash: string,
  expiresAt: number,
) {
  await env.SHARES.put(objectKey(id), bytes, {
    customMetadata: { deleteHash, expiresAt: String(expiresAt) },
    httpMetadata: { contentType: "application/octet-stream" },
  });
}
export async function fetchCipher(env: Env, id: string) {
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
      "X-Neuron-Expires-At": String(expiry),
    },
  });
}
export async function removeCipher(env: Env, id: string, token: string) {
  const object = await env.SHARES.head(objectKey(id));
  if (!object) throw new HttpError(404, "Share not found or already removed.");
  if (
    !constantEqual(
      await hashToken(token),
      object.customMetadata?.deleteHash ?? "",
    )
  )
    throw new HttpError(403, "Incorrect deletion capability.");
  await env.SHARES.delete(object.key);
}
export async function purgeExpired(env: Env) {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await env.SHARES.list({
      prefix: "share/",
      cursor,
      limit: 200,
      include: ["customMetadata"],
    });
    const expired = page.objects
      .filter(
        (o) =>
          !Number.isFinite(Number(o.customMetadata?.expiresAt)) ||
          Number(o.customMetadata?.expiresAt) <= Date.now(),
      )
      .map((o) => o.key);
    if (expired.length) {
      await env.SHARES.delete(expired);
      deleted += expired.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}
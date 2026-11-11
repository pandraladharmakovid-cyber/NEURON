import type { io } from "@tensorflow/tfjs";
import { sha256 } from "../lib/checksums";
import { runActivity } from "./update-manager";
export const PACK_ID = "mobilenet-v2-1.0-pinned-2026-11";
export const MODEL_FILES = [
  {
    name: "model.json",
    bytes: 86414,
    hash: "62c47d7f217d49a68528ea88d4bbbf1b09d0a13892eeff14b3e41ff6878de099",
  },
  {
    name: "group1-shard1of4.bin",
    bytes: 4194304,
    hash: "a37058241ca33e2427683001d5cc00a2164a41c07d7373b435594c0e7319dd68",
  },
  {
    name: "group1-shard2of4.bin",
    bytes: 4194304,
    hash: "8da74e0230284f5028a979d2bd652ec569943bcb19e45ff027a923e718e75d11",
  },
  {
    name: "group1-shard3of4.bin",
    bytes: 4194304,
    hash: "b7c206e89fb85fec5fe18a1bf5e0b4aa5d9c502636b60930bf1f1dae58ca9bd1",
  },
  {
    name: "group1-shard4of4.bin",
    bytes: 1373484,
    hash: "109deb891cb50db7dea8c70bfd2e37e0db38de9891f63a8d5f40633645f4017d",
  },
] as const;
const INDEX_CACHE = "neuron-model-index-v1",
  INDEX_URL = "/__neuron_pack_index__";
const source =
  "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2/";
function key(name: string) {
  return new URL("/__neuron_pack__/" + PACK_ID + "/" + name, location.origin)
    .href;
}
export function validateEncoderManifest(value: unknown) {
  const model = value as {
    modelTopology?: object;
    weightsManifest?: Array<{
      paths: string[];
      weights: io.WeightsManifestEntry[];
    }>;
    signature?: io.ModelArtifacts["signature"];
    userDefinedMetadata?: io.ModelArtifacts["userDefinedMetadata"];
  };
  if (
    !model ||
    typeof model.modelTopology !== "object" ||
    !Array.isArray(model.weightsManifest) ||
    model.weightsManifest.length !== 1
  )
    throw new Error("Unsupported encoder manifest.");
  if (
    JSON.stringify(model.weightsManifest[0].paths) !==
    JSON.stringify(MODEL_FILES.slice(1).map((f) => f.name))
  )
    throw new Error("Unexpected encoder shard paths.");
  return model;
}
async function pointer() {
  if (!("caches" in globalThis))
    throw new Error(
      "Persistent model packs require Cache Storage in HTTPS or localhost.",
    );
  const response = await (await caches.open(INDEX_CACHE)).match(INDEX_URL);
  if (!response) return null;
  try {
    const p = await response.json();
    return p.id === PACK_ID &&
      typeof p.cache === "string" &&
      p.cache.startsWith("neuron-pack-")
      ? (p.cache as string)
      : null;
  } catch {
    return null;
  }
}
async function verified(cache: Cache, name: string) {
  const spec = MODEL_FILES.find((f) => f.name === name);
  if (!spec) throw new Error("Unknown asset.");
  const response = await cache.match(key(name));
  if (!response) throw new Error("Model pack is incomplete.");
  const data = await response.arrayBuffer();
  if (data.byteLength !== spec.bytes || (await sha256(data)) !== spec.hash)
    throw new Error(
      "Model pack integrity check failed. Remove and download the pack again.",
    );
  return data;
}
export async function packStatus() {
  try {
    const p = await pointer();
    if (!p) return { ready: false, bytes: 0, error: "" };
    const cache = await caches.open(p);
    for (const file of MODEL_FILES) await verified(cache, file.name);
    return {
      ready: true,
      bytes: MODEL_FILES.reduce((n, f) => n + f.bytes, 0),
      error: "",
    };
  } catch (e) {
    return {
      ready: false,
      bytes: 0,
      error: e instanceof Error ? e.message : "Pack unavailable",
    };
  }
}
async function fetchBounded(url: string, limit: number, signal: AbortSignal) {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok || !response.body)
    throw new Error(`Asset download failed (${response.status}).`);
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("Asset exceeded its pinned size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function downloadPack(
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void = () => {},
) {
  const execute = () =>
    runActivity(async () => {
      if ((await packStatus()).ready) return;
      const cacheName = "neuron-pack-" + crypto.randomUUID(),
        cache = await caches.open(cacheName);
      let committed = false,
        done = 0;
      const total = MODEL_FILES.reduce((n, f) => n + f.bytes, 0);
      try {
        for (const file of MODEL_FILES) {
          signal.throwIfAborted();
          const bytes = await fetchBounded(
            source + file.name + "?tfjs-format=file",
            file.bytes,
            signal,
          );
          if (
            bytes.length !== file.bytes ||
            (await sha256(bytes)) !== file.hash
          )
            throw new Error(
              "Downloaded encoder differs from the pinned version. No unverified weights were installed.",
            );
          await cache.put(key(file.name), new Response(bytes as BodyInit));
          done += file.bytes;
          onProgress(done, total);
        }
        signal.throwIfAborted();
        await verified(cache, "model.json");
        validateEncoderManifest(
          JSON.parse(
            new TextDecoder().decode(await verified(cache, "model.json")),
          ),
        );
        await (
          await caches.open(INDEX_CACHE)
        ).put(
          INDEX_URL,
          new Response(JSON.stringify({ id: PACK_ID, cache: cacheName })),
        );
        committed = true;
      } finally {
        if (!committed) await caches.delete(cacheName);
      }
    });
  if (navigator.locks)
    return navigator.locks.request(
      "neuron-assets",
      { mode: "exclusive" },
      execute,
    );
  return execute();
}
export async function removePack() {
  const remove = async () => {
    await (await caches.open(INDEX_CACHE)).delete(INDEX_URL);
    for (const name of await caches.keys())
      if (name.startsWith("neuron-pack-")) await caches.delete(name);
  };
  if (navigator.locks)
    return navigator.locks.request("neuron-assets", { mode: "exclusive" }, () =>
      runActivity(remove),
    );
  return runActivity(remove);
}
export async function encoderArtifacts(): Promise<io.ModelArtifacts> {
  if (!(await packStatus()).ready) {
    if (!navigator.onLine)
      throw new Error(
        "No verified image encoder is cached. Reconnect and download it in Settings.",
      );
    await downloadPack(new AbortController().signal);
  }
  const name = await pointer();
  if (!name) throw new Error("Encoder pack was removed. Retry to reinstall.");
  const cache = await caches.open(name);
  const model = validateEncoderManifest(
    JSON.parse(new TextDecoder().decode(await verified(cache, "model.json"))),
  );
  const parts = await Promise.all(
    MODEL_FILES.slice(1).map((f) => verified(cache, f.name)),
  );
  const data = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const p of parts) {
    data.set(new Uint8Array(p), offset);
    offset += p.byteLength;
  }
  return {
    modelTopology: model.modelTopology!,
    weightSpecs: model.weightsManifest![0].weights,
    weightData: data.buffer,
    signature: model.signature,
    userDefinedMetadata: model.userDefinedMetadata,
  };
}
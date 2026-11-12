import "fake-indexeddb/auto";
import { afterEach, it, expect, vi } from "vitest";
import {
  localInventory,
  inspectLocalIntegrity,
  diagnosticSummary,
} from "../features/settings/StorageManager";
import { createProject } from "../features/projects/project.service";
import { database, deleteProject } from "../lib/db";
import { sha256 } from "../lib/checksums";
const ids: string[] = [];
afterEach(async () => {
  for (const id of ids.splice(0)) await deleteProject(id);
  vi.unstubAllGlobals();
});
it("counts real IndexedDB records and verifies stored image checksums without mutating them", async () => {
  vi.stubGlobal("navigator", {
    storage: {
      estimate: async () => ({ usage: 123, quota: 10000 }),
      persisted: async () => false,
    },
  });
  const p = await createProject("Private project name");
  ids.push(p.id);
  const blob = new Blob(["private pixels"], { type: "image/jpeg" }),
    sample = {
      id: crypto.randomUUID(),
      projectId: p.id,
      labelId: p.labels[0].id,
      blob,
      hash: await sha256(blob),
      createdAt: Date.now(),
    };
  const db = await database();
  await db.add("samples", sample);
  const inventory = await localInventory();
  expect(inventory.image.samples).toBe(1);
  expect(inventory.image.blobBytes).toBe(blob.size);
  const result = await inspectLocalIntegrity(new AbortController().signal);
  expect(result.complete).toBe(true);
  expect(result.issues).toEqual([]);
  const output = JSON.stringify(diagnosticSummary(inventory, result));
  for (const secret of [p.name, p.id, sample.id, sample.hash, "private pixels"])
    expect(output).not.toContain(secret);
  expect((await db.get("samples", sample.id))?.blob.size).toBe(blob.size);
});
it("reports corrupt content and orphan references without automatic repair or deletion", async () => {
  const p = await createProject("corruption");
  ids.push(p.id);
  const db = await database(),
    id = crypto.randomUUID();
  await db.add("samples", {
    id,
    projectId: p.id,
    labelId: "missing-class",
    blob: new Blob(["modified"]),
    hash: "0".repeat(64),
    createdAt: 1,
  });
  const result = await inspectLocalIntegrity(new AbortController().signal);
  expect(result.issues.some((i) => i.includes("reference"))).toBe(true);
  expect(result.issues.some((i) => i.includes("checksum"))).toBe(true);
  expect(await db.get("samples", id)).toBeDefined();
});
it("supports cancellation before scanning and does not fabricate a complete report", async () => {
  const c = new AbortController();
  c.abort();
  await expect(inspectLocalIntegrity(c.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});

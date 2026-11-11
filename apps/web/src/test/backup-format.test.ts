import { describe, it, expect } from "vitest";
import {
  encodeBackup,
  decodeBackup,
  validateBackupShape,
  type Snapshot,
} from "../lib/backup-format";
import { sha256 } from "../lib/checksums";
function snapshot(): Snapshot {
  return {
    project: {
      id: "p",
      name: "Plants",
      labels: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      createdAt: 1,
      updatedAt: 2,
    },
    samples: [
      {
        id: "s",
        projectId: "p",
        labelId: "a",
        createdAt: 1,
        blob: new Blob([new Uint8Array([255, 216, 255, 224, 0, 0])], {
          type: "image/jpeg",
        }),
      },
    ],
    versions: [],
    feedback: [],
  };
}
describe("full project backup", () => {
  it("hashes known vectors", async () =>
    expect(await sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ));
  it("round trips media and remaps IDs without overwriting the source", async () => {
    const s = snapshot(),
      file = await encodeBackup(s),
      restored = await decodeBackup(file);
    expect(restored.project.id).not.toBe("p");
    expect(restored.samples[0].id).not.toBe("s");
    expect(restored.samples[0].projectId).toBe(restored.project.id);
    expect(
      new Uint8Array(await restored.samples[0].blob.arrayBuffer()),
    ).toEqual(new Uint8Array(await s.samples[0].blob.arrayBuffer()));
  });
  it("rejects corrupted media before restore", async () => {
    const raw = JSON.parse(await (await encodeBackup(snapshot())).text());
    raw.samples[0].hash = "0".repeat(64);
    await expect(decodeBackup(new Blob([JSON.stringify(raw)]))).rejects.toThrow(
      "checksum",
    );
  });
  it("rejects missing active versions", async () => {
    const raw = JSON.parse(await (await encodeBackup(snapshot())).text());
    raw.project.activeVersionId = "absent";
    expect(() => validateBackupShape(raw)).toThrow("Active model");
  });
  it("rejects duplicate labels", async () => {
    const raw = JSON.parse(await (await encodeBackup(snapshot())).text());
    raw.project.labels[1].name = "A";
    expect(() => validateBackupShape(raw)).toThrow("classes");
  });
  it("rejects unknown backup formats", async () =>
    await expect(
      decodeBackup(new Blob(['{"format":"javascript"}'])),
    ).rejects.toThrow());
  it("rejects invalid JSON", async () =>
    await expect(decodeBackup(new Blob(["{"]))).rejects.toThrow("JSON"));
  it("enforces sample count", async () => {
    const raw = JSON.parse(await (await encodeBackup(snapshot())).text());
    raw.samples = Array(1001).fill(raw.samples[0]);
    expect(() => validateBackupShape(raw)).toThrow("limits");
  });
});
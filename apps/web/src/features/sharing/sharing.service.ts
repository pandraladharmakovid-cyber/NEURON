import { randomSecret, secretHash, encryptModel, decryptModel } from "./crypto";
import { encodeShared, decodeShared, type SharedModel } from "./share-format";
import { shareLink, parseShareLink } from "./share-links";
import {
  uploadEncrypted,
  downloadEncrypted,
  revokeEncrypted,
} from "./relay-client";
import {
  saveReceipt,
  forgetReceipt,
  type ShareReceipt,
} from "./receipt.repository";
import { runActivity } from "../../pwa/update-manager";
import { database, trackTransaction } from "../../lib/db";
import { uid, type Project, type ModelVersion } from "../../lib/types";
export async function createShare(
  project: Project,
  version: ModelVersion,
  ttl: number,
  origin: string,
  signal: AbortSignal,
) {
  return runActivity(async () => {
    if (version.projectId !== project.id)
      throw new Error("Model does not belong to this project.");
    const token = randomSecret(),
      encoded = encodeShared(project.name, version.artifact),
      encrypted = await encryptModel(encoded);
    signal.throwIfAborted();
    const remote = await uploadEncrypted(
      encrypted.bytes,
      await secretHash(token),
      ttl,
      signal,
    );
    const receipt: ShareReceipt = {
      format: "neuron-share-receipt",
      version: 1,
      id: remote.id,
      projectId: project.id,
      versionId: version.id,
      name: project.name,
      createdAt: remote.expiresAt - ttl * 1000,
      expiresAt: remote.expiresAt,
      deleteToken: token,
      link: shareLink(origin, remote.id, encrypted.secret),
    };
    let persisted = true;
    try {
      await saveReceipt(receipt);
    } catch {
      persisted = false;
    }
    return { receipt, persisted };
  });
}
export async function receiveShare(
  id: string,
  secret: string,
  signal: AbortSignal,
) {
  return runActivity(async () =>
    decodeShared(
      await decryptModel(await downloadEncrypted(id, signal), secret),
    ),
  );
}
export async function importReceived(model: SharedModel) {
  return runActivity(async () => {
    const safe = decodeShared(encodeShared(model.name, model.artifact)),
      now = Date.now(),
      project: Project = {
        id: uid(),
        name: safe.name,
        labels: safe.artifact.labels,
        createdAt: now,
        updatedAt: now,
      },
      version: ModelVersion = {
        id: uid(),
        projectId: project.id,
        artifact: safe.artifact,
        createdAt: now,
      };
    project.activeVersionId = version.id;
    const db = await database(),
      tx = trackTransaction(
        db.transaction(["projects", "versions"], "readwrite"),
      );
    await tx.objectStore("projects").add(project);
    await tx.objectStore("versions").add(version);
    await tx.done;
    return project;
  });
}
export async function revokeShare(receipt: ShareReceipt, origin: string) {
  if (parseShareLink(receipt.link).origin !== origin)
    throw new Error(
      "Manage this receipt from its original application origin.",
    );
  return runActivity(async () => {
    await revokeEncrypted(receipt.id, receipt.deleteToken);
    await forgetReceipt(receipt.id);
  });
}
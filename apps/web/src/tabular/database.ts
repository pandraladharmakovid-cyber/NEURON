import { openDB, type DBSchema } from "idb";
import type { Project, Dataset, Version } from "./types";
interface TabularDB extends DBSchema {
  projects: { key: string; value: Project };
  datasets: { key: string; value: Dataset };
  versions: { key: string; value: Version; indexes: { "by-project": string } };
}
let connection: ReturnType<typeof openDB<TabularDB>> | undefined;
export function tabularDB() {
  return (connection ??= openDB<TabularDB>("neuron-tabular", 1, {
    upgrade(db) {
      db.createObjectStore("projects", { keyPath: "id" });
      db.createObjectStore("datasets", { keyPath: "projectId" });
      db.createObjectStore("versions", { keyPath: "id" }).createIndex(
        "by-project",
        "projectId",
      );
    },
    blocking() {
      connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }));
}
export async function closeTabularDB() {
  (await connection)?.close();
  connection = undefined;
}
export function track<T extends { done: Promise<unknown> }>(tx: T): T {
  void tx.done.catch(() => {});
  return tx;
}

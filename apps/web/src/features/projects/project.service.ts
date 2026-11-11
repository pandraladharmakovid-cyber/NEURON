import { saveProject } from "../../lib/db";
import { uid, type Project, type Label } from "../../lib/types";
export function cleanName(value: string, max = 64) {
  const s = value.trim();
  if (!s || s.length > max)
    throw new Error(`Use between 1 and ${max} characters.`);
  return s;
}
export function validateLabels(labels: Label[]) {
  if (labels.length < 2 || labels.length > 20)
    throw new Error("Use between 2 and 20 classes.");
  const names = labels.map((l) => cleanName(l.name).toLocaleLowerCase());
  if (new Set(names).size !== names.length)
    throw new Error("Class names must be unique.");
}
export async function createProject(name: string): Promise<Project> {
  const now = Date.now();
  const p: Project = {
    id: uid(),
    name: cleanName(name),
    createdAt: now,
    updatedAt: now,
    labels: [
      { id: uid(), name: "Class 1" },
      { id: uid(), name: "Class 2" },
    ],
  };
  await saveProject(p);
  return p;
}
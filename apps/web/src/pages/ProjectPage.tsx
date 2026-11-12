import { DatasetEditor } from "../features/datasets/DatasetEditor";
export function ProjectPage({ id }: { id: string }) {
  return <DatasetEditor key={id} id={id} />;
}

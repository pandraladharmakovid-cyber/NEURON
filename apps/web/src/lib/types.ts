export type Label = { id: string; name: string };
export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  labels: Label[];
  activeVersionId?: string;
};
export type Sample = {
  id: string;
  projectId: string;
  labelId: string;
  blob: Blob;
  createdAt: number;
  hash?: string;
};
export type EpochMetric = {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
};
export type Evaluation = {
  accuracy: number;
  matrix: number[][];
  total: number;
};
export type ModelArtifact = {
  provenance?: {
    datasetHash: string;
    validationHash: string;
    seed: number;
    sampleCount: number;
  };
  format: "neuron-image";
  version: 1;
  encoder: "mobilenet-v2-1.0";
  embeddingSize: 1280;
  labels: Label[];
  weightSpecs: Array<{ name: string; shape: number[]; dtype: "float32" }>;
  weightData: string;
  epochs: EpochMetric[];
  evaluation: Evaluation;
  createdAt: number;
};
export type ModelVersion = {
  id: string;
  projectId: string;
  artifact: ModelArtifact;
  createdAt: number;
};
export type Prediction = { label: string; score: number };
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";
export const uid = () => crypto.randomUUID();

export type FeedbackItem = {
  id: string;
  projectId: string;
  versionId: string;
  labelId: string;
  blob: Blob;
  createdAt: number;
  predictedLabel: string;
};
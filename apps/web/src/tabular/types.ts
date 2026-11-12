export type Task = "classification" | "regression";
export type FeatureKind = "numeric" | "categorical";
export type Feature = { name: string; kind: FeatureKind };
export type Configuration = { task: Task; target: string; features: Feature[] };
export type Options = {
  epochs: number;
  learningRate: number;
  l2: number;
  seed: number;
  patience: number;
  batchSize: number;
};
export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  config: Configuration | null;
  activeVersionId?: string;
};
export type ParsedCSV = { headers: string[]; rows: string[][] };
export type Dataset = ParsedCSV & {
  projectId: string;
  fileName: string;
  hash: string;
  createdAt: number;
};
export type NumericSpec = {
  kind: "numeric";
  name: string;
  mean: number;
  std: number;
  clip: 8;
};
export type CategorySpec = {
  kind: "categorical";
  name: string;
  levels: string[];
};
export type Preprocessor = {
  width: number;
  features: (NumericSpec | CategorySpec)[];
};
export type ClassificationReport = {
  kind: "classification";
  rows: number;
  accuracy: number;
  macroF1: number;
  logLoss: number;
  confusion: number[][];
};
export type RegressionReport = {
  kind: "regression";
  rows: number;
  mae: number;
  rmse: number;
  r2: number | null;
};
export type Report = ClassificationReport | RegressionReport;
export type Epoch = {
  epoch: number;
  trainLoss: number;
  validationLoss: number;
  validationScore: number;
};
export type Provenance = {
  datasetHash: string;
  testHash: string;
  seed: number;
  trainRows: number;
  validationRows: number;
  testRows: number;
  bestEpoch: number;
};
export type Artifact = {
  format: "neuron-tabular";
  version: 1;
  algorithm: "softmax-linear" | "ridge-linear";
  config: Configuration;
  preprocessing: Preprocessor;
  labels: string[];
  targetScale: { mean: number; std: number };
  weights: number[];
  bias: number[];
  history: Epoch[];
  evaluation: { validation: Report; test: Report };
  provenance: Provenance;
  createdAt: number;
};
export type Version = {
  id: string;
  projectId: string;
  createdAt: number;
  artifact: Artifact;
};
export type Snapshot = {
  project: Project;
  dataset: Dataset | null;
  versions: Version[];
};
export type Prediction =
  | {
      kind: "classification";
      label: string;
      scores: { label: string; score: number }[];
    }
  | { kind: "regression"; value: number };
export type Progress = {
  stage: string;
  epoch: number;
  total: number;
  history: Epoch[];
};
export type TrainingInput = {
  dataset: Dataset;
  config: Configuration;
  options: Options;
};
export type Split = { train: number[]; validation: number[]; test: number[] };

import { useImageTraining } from "../features/training/training.store";
import { TrainingControls } from "../features/training/TrainingControls";
import { TrainingCharts } from "../features/training/TrainingCharts";
import { EvaluationReport } from "../features/training/EvaluationReport";
export function TrainingPage({ id }: { id: string }) {
  const state = useImageTraining(id);
  return (
    <>
      <a className="back-link" href={`#/projects/${id}`}>
        ← Dataset
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">02 / TRAIN ON YOUR DEVICE</div>
          <h1>Let your model learn.</h1>
          <p>Real image features. Real weight updates. No cloud training.</p>
        </div>
        <span className="tag">{state.project?.name ?? "IMAGE STUDIO"}</span>
      </div>
      {state.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      <a className="small-link" href={`#/projects/${id}/evolve`}>
        Review feedback & compare saved versions →
      </a>
      <div className="training-layout">
        <TrainingControls state={state} />
        <TrainingCharts
          running={state.running}
          progress={state.progress}
          result={state.result}
          id={id}
        />
      </div>
      {state.result && <EvaluationReport result={state.result} />}
    </>
  );
}

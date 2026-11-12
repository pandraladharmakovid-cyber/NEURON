export function StudioHeader({
  id,
  title,
  subtitle,
  step,
}: {
  id: string;
  title: string;
  subtitle: string;
  step: "data" | "train" | "predict";
}) {
  return (
    <>
      <a className="back-link" href="#/tabular">
        ← CSV projects
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CSV STUDIO / LOCAL CPU WORKERS</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <span className="tag">TABULAR · PHASE 04</span>
      </div>
      <div className="workflow-tabs">
        <a
          className={step === "data" ? "current" : ""}
          href={`#/tabular/${id}`}
        >
          1. Dataset & columns
        </a>
        <a
          className={step === "train" ? "current" : ""}
          href={`#/tabular/${id}/train`}
        >
          2. Train & evaluate
        </a>
        <a
          className={step === "predict" ? "current" : ""}
          href={`#/tabular/${id}/predict`}
        >
          3. Predict & versions
        </a>
      </div>
    </>
  );
}

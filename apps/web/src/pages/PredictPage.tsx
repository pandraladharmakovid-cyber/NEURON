import { useEffect, useRef, useState } from "react";
import { Camera, Download, Image, RefreshCw } from "lucide-react";
import { getProject, listVersions, activateVersion } from "../lib/db";
import {
  type Project,
  type ModelVersion,
  type Prediction,
  errorMessage,
} from "../lib/types";
import { predictor } from "../features/inference/inference.service";
import { normalizeImage } from "../features/datasets/dataset.service";
import { exportModel } from "../lib/model-format";
import { FeedbackCapture } from "../features/inference/FeedbackCapture";
import { Button } from "../components/ui/Button";
import { FileDropzone } from "../components/ui/FileDropzone";
import { LinkShareDialog } from "../features/sharing/LinkShareDialog";
export function PredictPage({ id }: { id: string }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null),
    [versions, setVersions] = useState<ModelVersion[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [results, setResults] = useState<Prediction[]>([]),
    [preview, setPreview] = useState(""),
    [camera, setCamera] = useState(false),
    [latency, setLatency] = useState(0);
  const [feedbackBlob, setFeedbackBlob] = useState<Blob | null>(null);
  const engine = useRef<Awaited<ReturnType<typeof predictor>> | null>(null),
    stream = useRef<MediaStream | null>(null),
    video = useRef<HTMLVideoElement>(null),
    alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    Promise.all([getProject(id), listVersions(id)])
      .then(([p, v]) => {
        if (!alive.current) return;
        setProject(p ?? null);
        setVersions(v);
        setSelected(p?.activeVersionId ?? v[0]?.id ?? "");
      })
      .catch((e) => {
        if (alive.current) setError(errorMessage(e));
      });
    return () => {
      alive.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id]);
  useEffect(() => {
    if (!camera || !video.current || !stream.current) return;
    video.current.srcObject = stream.current;
    void video.current.play().catch((e) => setError(errorMessage(e)));
  }, [camera]);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setResults([]);
    setFeedbackBlob(null);
    const version = versions.find((v) => v.id === selected);
    if (!version) return;
    predictor(version.artifact)
      .then((p) => {
        if (cancelled) p.dispose();
        else {
          engine.current = p;
          setReady(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [selected, versions]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function predict(blob: Blob) {
    if (!engine.current || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const start = performance.now();
    try {
      const result = await engine.current.predict(blob);
      if (alive.current) {
        setFeedbackBlob(blob);
        setResults(result);
        setLatency(performance.now() - start);
        setPreview(URL.createObjectURL(blob));
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function fromFile(files: File[]) {
    if (!files[0] || inFlight.current) return;
    setError("");
    try {
      await predict(await normalizeImage(files[0]));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera requires HTTPS or localhost and browser camera support.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = s;
      setCamera(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth || busy) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (blob) await predict(blob);
  }
  const version = versions.find((v) => v.id === selected);
  return (
    <>
      <a className="back-link" href={`#/projects/${id}`}>
        ← Dataset
      </a>
      <div className="page-heading">
        <div>
          <div className="eyebrow">03 / ACTIVATE YOUR IDEA</div>
          <h1>Meet your model.</h1>
          <p>
            Test a new image or a camera frame. Predictions run on this device.
          </p>
        </div>
        {version && (
          <Button
            variant="secondary"
            onClick={() => {
              try {
                exportModel(version.artifact, project?.name ?? "model");
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Download size={16} /> Export model
          </Button>
        )}
      </div>
      <a className="small-link" href={`#/projects/${id}/evolve`}>
        Feedback review, comparisons & version history →
      </a>
      {version && (
        <div className="share-entry">
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            Create encrypted share link
          </Button>
          <a href="#/shares">Manage share links →</a>
        </div>
      )}
      {shareOpen && version && project && (
        <LinkShareDialog
          project={project}
          version={version}
          onClose={() => setShareOpen(false)}
        />
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!versions.length ? (
        <div className="empty-state">
          <Image size={40} />
          <h2>No saved model yet</h2>
          <p>
            Train your dataset first, or import a supported model in Settings.
          </p>
          <a className="btn btn-primary" href={`#/projects/${id}/train`}>
            Go to training
          </a>
        </div>
      ) : (
        <>
          <section className="panel version-bar">
            <label className="field">
              Model version
              <select
                disabled={busy}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {versions.map((v, i) => (
                  <option value={v.id} key={v.id}>
                    Version {versions.length - i} ·{" "}
                    {new Date(v.createdAt).toLocaleString()} ·{" "}
                    {(v.artifact.evaluation.accuracy * 100).toFixed(1)}%
                    validation
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              disabled={
                busy || !project || selected === project.activeVersionId
              }
              onClick={() => {
                if (!project) return;
                void activateVersion(id, selected)
                  .then(() =>
                    setProject({ ...project, activeVersionId: selected }),
                  )
                  .catch((e) => setError(errorMessage(e)));
              }}
            >
              Make active
            </Button>
          </section>
          <div className="prediction-layout">
            <section className="panel">
              <h2>Give it something new</h2>
              <FileDropzone
                multiple={false}
                disabled={!ready || busy}
                onFiles={(files) => void fromFile(files)}
              />
              <div className="camera-actions">
                {camera ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy || !ready}
                      onClick={() => void capture()}
                    >
                      <Camera size={16} /> Predict this frame
                    </Button>
                    <Button variant="ghost" onClick={stopCamera}>
                      Stop camera
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => void startCamera()}
                  >
                    <Camera size={16} /> Use camera
                  </Button>
                )}
              </div>
              {camera && (
                <video
                  className="camera-video"
                  ref={video}
                  autoPlay
                  muted
                  playsInline
                  aria-label="Camera preview"
                />
              )}
              {preview && !camera && (
                <img
                  className="prediction-image"
                  src={preview}
                  alt="Image being classified"
                />
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>Predictions</h2>
                <span className="tag">
                  {busy ? "PROCESSING" : ready ? "LOCAL INFERENCE" : "LOADING"}
                </span>
              </div>
              {results.length ? (
                <>
                  <div className="prediction-winner">
                    {results[0].label}
                    <strong>{(results[0].score * 100).toFixed(1)}%</strong>
                  </div>
                  {results.map((r) => (
                    <div className="prediction-row" key={r.label}>
                      <div>
                        <span>{r.label}</span>
                        <strong>{(r.score * 100).toFixed(1)}%</strong>
                      </div>
                      <progress value={r.score} max={1} />
                    </div>
                  ))}
                  <p className="phase-note">
                    {Math.round(latency)} ms including feature extraction.
                    Scores are relative softmax outputs, not calibrated
                    probabilities or proof of correctness.
                  </p>
                </>
              ) : (
                <div className="empty-monitor">
                  <RefreshCw size={34} />
                  <p>
                    {ready
                      ? "Add an unseen image to see actual predictions."
                      : "Loading the saved classifier…"}
                  </p>
                </div>
              )}
              <div className="notice">
                No image is uploaded. The verified cached encoder works offline.
                Camera frames are processed only when you choose “Predict this
                frame”.
              </div>
              {feedbackBlob && project && version && results[0] && (
                <FeedbackCapture
                  key={preview}
                  project={project}
                  versionId={version.id}
                  blob={feedbackBlob}
                  predictedLabel={results[0].label}
                />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
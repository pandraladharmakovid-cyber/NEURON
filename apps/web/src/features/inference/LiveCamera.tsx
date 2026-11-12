import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraSession,
  cameraSupported,
  cameraPermission,
  captureFrame,
} from "../../lib/permissions";
import { explainError } from "../../lib/errors";
import { usePreferences } from "../../app/providers";
import { Button } from "../../components/ui/Button";
import { CapabilityNotice } from "../../components/ui/CapabilityNotice";
export function LiveCamera({
  onCapture,
  disabled = false,
  captureLabel = "Predict this frame",
}: {
  onCapture: (file: File) => Promise<void>;
  disabled?: boolean;
  captureLabel?: string;
}) {
  const video = useRef<HTMLVideoElement>(null),
    session = useRef(new CameraSession()),
    alive = useRef(true),
    requesting = useRef(false),
    capturing = useRef(false),
    generation = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [permission, setPermission] = useState<PermissionState | "unsupported">(
      "unsupported",
    ),
    [frameReady, setFrameReady] = useState(false);
  const { preferences } = usePreferences();
  const stop = useCallback(() => {
    generation.current++;
    session.current.stop();
    requesting.current = false;
    setPending(false);
    setStream(null);
    setFrameReady(false);
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => {
    alive.current = true;
    void cameraPermission().then((p) => {
      if (alive.current) setPermission(p);
    });
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pagehide", stop);
    window.addEventListener("hashchange", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      session.current.stop();
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("hashchange", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [stop]);
  useEffect(() => {
    if (!preferences.cameraEnabled) stop();
  }, [preferences.cameraEnabled, stop]);
  useEffect(() => {
    const element = video.current;
    if (!stream || !element) return;
    element.srcObject = stream;
    void element.play().catch((e) => {
      if (alive.current && element.srcObject === stream) {
        setError(explainError(e).message);
        stop();
      }
    });
    const ended = () => {
      if (alive.current) {
        stop();
        setError("The camera stream ended. Start it again or import an image.");
      }
    };
    stream.getVideoTracks().forEach((t) => t.addEventListener("ended", ended));
    return () => {
      stream
        .getVideoTracks()
        .forEach((t) => t.removeEventListener("ended", ended));
      element.srcObject = null;
    };
  }, [stream, stop]);
  async function start() {
    if (requesting.current || !preferences.cameraEnabled) return;
    const ticket = ++generation.current;
    requesting.current = true;
    setPending(true);
    setError("");
    try {
      const next = await session.current.start();
      if (!alive.current || ticket !== generation.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      setStream(next);
      setPermission("granted");
    } catch (e) {
      if (alive.current && ticket === generation.current)
        setError(explainError(e).message);
    } finally {
      if (ticket === generation.current) {
        requesting.current = false;
        if (alive.current) setPending(false);
      }
    }
  }
  async function capture() {
    if (capturing.current || disabled || !video.current || !stream) return;
    capturing.current = true;
    setBusy(true);
    setError("");
    try {
      const file = await captureFrame(video.current);
      if (alive.current) await onCapture(file);
    } catch (e) {
      if (alive.current) setError(explainError(e).message);
    } finally {
      capturing.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="camera-panel">
      <CapabilityNotice
        supported={cameraSupported()}
        title="Camera unavailable"
      >
        Use HTTPS/localhost and a supported browser, or import JPEG/PNG/WebP
        images.
      </CapabilityNotice>
      {!preferences.cameraEnabled && (
        <p className="notice">
          Camera use is disabled in Privacy settings. File imports still work.
        </p>
      )}
      <p className="camera-status">
        Camera permission:{" "}
        {permission === "unsupported"
          ? "browser will ask on start"
          : permission}
        . No microphone is requested. Nothing is captured automatically; only
        the selected still frame is used. Switching away/hidden tabs stops the
        camera.
      </p>
      <div className="camera-actions">
        {stream ? (
          <>
            <Button
              variant="secondary"
              disabled={disabled || busy || !frameReady}
              onClick={() => void capture()}
            >
              {busy ? "Capturing…" : captureLabel}
            </Button>
            <Button variant="ghost" onClick={stop}>
              Stop camera
            </Button>
          </>
        ) : pending ? (
          <Button variant="secondary" onClick={stop}>
            Cancel camera request
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={
              !cameraSupported() || !preferences.cameraEnabled || disabled
            }
            onClick={() => void start()}
          >
            Use camera
          </Button>
        )}
      </div>
      {stream && (
        <video
          className="camera-video"
          ref={video}
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
          onLoadedData={() => setFrameReady(true)}
        />
      )}
      <p className="camera-status">
        {stream
          ? frameReady
            ? "Preview ready. Capture only when you choose."
            : "Waiting for first camera frame…"
          : pending
            ? "Waiting for browser permission…"
            : "Camera is stopped."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

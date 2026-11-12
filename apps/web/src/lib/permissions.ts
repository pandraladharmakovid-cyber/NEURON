import { cancelled, requireCondition } from "./errors";
export function cameraSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    globalThis.isSecureContext !== false
  );
}
export async function cameraPermission(): Promise<
  PermissionState | "unsupported"
> {
  try {
    if (!navigator.permissions?.query) return "unsupported";
    return (
      await navigator.permissions.query({ name: "camera" as PermissionName })
    ).state;
  } catch {
    return "unsupported";
  }
}
export function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
// A monotonically increasing generation also handles a user stopping while the
// browser's permission dialog is still open. Late-arriving streams are closed.
export class CameraSession {
  private generation = 0;
  private stream: MediaStream | null = null;
  async start(): Promise<MediaStream> {
    requireCondition(
      cameraSupported(),
      "Camera requires HTTPS/localhost and browser media-device support. Import an image instead.",
    );
    const generation = ++this.generation;
    stopTracks(this.stream);
    this.stream = null;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
      audio: false,
    });
    if (generation !== this.generation) {
      stopTracks(stream);
      throw cancelled("Camera request cancelled.");
    }
    this.stream = stream;
    return stream;
  }
  stop() {
    this.generation++;
    stopTracks(this.stream);
    this.stream = null;
  }
}
export async function captureFrame(video: HTMLVideoElement): Promise<File> {
  requireCondition(
    video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0,
    "Camera has no ready frame yet. Wait for the preview.",
  );
  const scale = Math.min(
    1,
    768 / Math.max(video.videoWidth, video.videoHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d");
  requireCondition(ctx, "Canvas unavailable. Use an image file instead.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Camera frame could not be encoded.")),
      "image/jpeg",
      0.9,
    ),
  );
  return new File([blob], "camera-" + Date.now() + ".jpg", {
    type: "image/jpeg",
  });
}

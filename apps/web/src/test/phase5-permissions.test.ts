import { afterEach, it, expect, vi } from "vitest";
import {
  CameraSession,
  cameraPermission,
  cameraSupported,
  stopTracks,
  captureFrame,
} from "../lib/permissions";
function stream() {
  const stop = vi.fn();
  return {
    value: {
      getTracks: () => [{ stop }],
      getVideoTracks: () => [{ stop }],
    } as unknown as MediaStream,
    stop,
  };
}
afterEach(() => vi.unstubAllGlobals());
it("never opens a microphone and stops the stream explicitly", async () => {
  const s = stream(),
    getUserMedia = vi.fn().mockResolvedValue(s.value);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const session = new CameraSession();
  await session.start();
  expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
  session.stop();
  expect(s.stop).toHaveBeenCalledOnce();
});
it("closes late streams after stopping while browser permission is pending", async () => {
  let resolve!: (value: MediaStream) => void;
  const request = new Promise<MediaStream>((r) => (resolve = r)),
    s = stream();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => request } });
  const session = new CameraSession(),
    pending = session.start();
  session.stop();
  resolve(s.value);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(s.stop).toHaveBeenCalledOnce();
});
it("closes a superseded stream and retains only the newest request", async () => {
  let resolve!: (value: MediaStream) => void;
  const first = stream(),
    second = stream(),
    request = new Promise<MediaStream>((r) => (resolve = r)),
    getUserMedia = vi
      .fn()
      .mockReturnValueOnce(request)
      .mockResolvedValueOnce(second.value);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const session = new CameraSession(),
    one = session.start();
  await session.start();
  resolve(first.value);
  await expect(one).rejects.toMatchObject({ name: "AbortError" });
  expect(first.stop).toHaveBeenCalledOnce();
  session.stop();
  expect(second.stop).toHaveBeenCalledOnce();
});
it("rejects unsupported cameras without initiating a device request", async () => {
  vi.stubGlobal("navigator", {});
  expect(cameraSupported()).toBe(false);
  await expect(new CameraSession().start()).rejects.toThrow(/HTTPS/);
  expect(await cameraPermission()).toBe("unsupported");
  stopTracks(null);
});
it("permission inspection handles unsupported and blocked Permissions API", async () => {
  vi.stubGlobal("navigator", {
    permissions: {
      query: vi.fn().mockRejectedValue(new Error("not supported")),
    },
  });
  expect(await cameraPermission()).toBe("unsupported");
});
it("refuses capture before a real video frame exists", async () => {
  await expect(
    captureFrame({
      readyState: 0,
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement),
  ).rejects.toThrow(/ready frame/);
});

import { useState } from "react";
import { LiveCamera } from "../inference/LiveCamera";
export function CapturePanel({
  className,
  disabled,
  onFiles,
}: {
  className: string;
  disabled: boolean;
  onFiles: (files: File[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Capture examples for {className}</summary>
      <p className="phase-note">
        Choose varied scenes and lighting. Near-identical camera frames can
        inflate validation scores. Each capture is normalized and saved locally,
        just like an imported image.
      </p>
      {open && (
        <LiveCamera
          disabled={disabled}
          captureLabel={`Save frame to ${className}`}
          onCapture={(file) => onFiles([file])}
        />
      )}
    </details>
  );
}

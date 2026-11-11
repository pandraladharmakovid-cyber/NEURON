import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
export function FileDropzone({
  onFiles,
  disabled = false,
  multiple = true,
  accept = "image/jpeg,image/png,image/webp",
  label = "Drop images here, or browse",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <UploadCloud size={26} />
      <button
        type="button"
        className="drop-action"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
      <small>JPEG, PNG, WebP · 15 MB per image</small>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
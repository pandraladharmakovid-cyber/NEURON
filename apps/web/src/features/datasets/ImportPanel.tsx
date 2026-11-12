import { FileDropzone } from "../../components/ui/FileDropzone";
export function ImportPanel({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => Promise<void>;
}) {
  return (
    <div>
      <FileDropzone
        disabled={disabled}
        onFiles={(files) => void onFiles(files)}
      />
      <p className="phase-note">
        JPEG, PNG or WebP · ≤15 MB per source image · decoded safety limit 40
        megapixels · normalized to ≤768px JPEG with white alpha background. Use
        files you have permission to process.
      </p>
    </div>
  );
}

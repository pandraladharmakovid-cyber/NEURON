import { useEffect, useState } from "react";
import type { Sample } from "../../lib/types";
import { Button } from "../../components/ui/Button";
function Thumbnail({
  sample,
  disabled,
  onRemove,
}: {
  sample: Sample;
  disabled: boolean;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(sample.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [sample.blob]);
  return (
    <div className="sample-thumb">
      <img src={url} alt="Training sample" loading="lazy" />
      <button disabled={disabled} aria-label="Remove sample" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}
export function SampleGrid({
  samples,
  disabled,
  onRemove,
}: {
  samples: Sample[];
  disabled: boolean;
  onRemove: (id: string) => void;
}) {
  const [page, setPage] = useState(0),
    size = 48,
    pages = Math.max(1, Math.ceil(samples.length / size)),
    current = Math.min(page, pages - 1);
  return (
    <div>
      <div className="sample-grid">
        {samples.slice(current * size, (current + 1) * size).map((sample) => (
          <Thumbnail
            key={sample.id}
            sample={sample}
            disabled={disabled}
            onRemove={() => onRemove(sample.id)}
          />
        ))}
      </div>
      {samples.length > size && (
        <div className="sample-toolbar">
          <Button
            variant="ghost"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous samples
          </Button>
          <small role="status">
            Page {current + 1}/{pages} · {samples.length} samples
          </small>
          <Button
            variant="ghost"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next samples
          </Button>
        </div>
      )}
    </div>
  );
}

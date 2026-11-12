export function Progress({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1,
    safeValue = Number.isFinite(value)
      ? Math.max(0, Math.min(safeTotal, value))
      : 0;
  return (
    <div className="job-progress">
      <span role="status">{label}</span>
      <progress aria-label={label} value={safeValue} max={safeTotal} />
      <small>
        {Math.round(safeValue)} / {Math.round(safeTotal)}
      </small>
    </div>
  );
}

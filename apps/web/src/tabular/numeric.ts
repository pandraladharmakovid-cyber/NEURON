export function numberValue(raw: string): number | null {
  const s = raw.trim();
  if (!s || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : null;
}
export function moments(values: number[]) {
  let n = 0,
    mean = 0,
    m2 = 0;
  for (const value of values) {
    n++;
    const delta = value - mean;
    mean += delta / n;
    m2 += delta * (value - mean);
  }
  return {
    mean: n ? mean : 0,
    std: n && m2 / n > 1e-18 ? Math.sqrt(Math.max(0, m2 / n)) : 1,
  };
}
export function finiteArray(values: unknown, max: number): values is number[] {
  return (
    Array.isArray(values) &&
    values.length <= max &&
    values.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e12,
    )
  );
}
export function displayNumber(n: number) {
  return Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 0.0001)
    ? n.toExponential(4)
    : n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

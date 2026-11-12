export function logits(
  x: Float32Array,
  weights: ArrayLike<number>,
  bias: ArrayLike<number>,
  outputs: number,
) {
  const values = new Float64Array(outputs);
  for (let k = 0; k < outputs; k++) {
    let total = bias[k];
    for (let j = 0; j < x.length; j++)
      total += weights[k * x.length + j] * x[j];
    values[k] = total;
  }
  return values;
}
export function softmax(values: ArrayLike<number>) {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) max = Math.max(max, values[i]);
  const out = Array.from(values, (v) => Math.exp(v - max));
  const total = out.reduce((a, b) => a + b, 0);
  return out.map((v) => v / total);
}
export function argmax(values: ArrayLike<number>) {
  let index = 0;
  for (let i = 1; i < values.length; i++)
    if (values[i] > values[index]) index = i;
  return index;
}

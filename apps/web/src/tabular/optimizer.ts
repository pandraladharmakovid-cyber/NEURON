export class Adam {
  private m: Float64Array;
  private v: Float64Array;
  private step = 0;
  constructor(
    size: number,
    private rate: number,
  ) {
    this.m = new Float64Array(size);
    this.v = new Float64Array(size);
  }
  update(parameters: Float64Array, gradient: Float64Array) {
    this.step++;
    let squared = 0;
    for (const g of gradient) squared += g * g;
    const scale = Math.min(1, 5 / (Math.sqrt(squared) || 1));
    for (let i = 0; i < parameters.length; i++) {
      const g = gradient[i] * scale;
      this.m[i] = 0.9 * this.m[i] + 0.1 * g;
      this.v[i] = 0.999 * this.v[i] + 0.001 * g * g;
      parameters[i] -=
        (this.rate * (this.m[i] / (1 - 0.9 ** this.step))) /
        (Math.sqrt(this.v[i] / (1 - 0.999 ** this.step)) + 1e-8);
      if (!Number.isFinite(parameters[i]))
        throw new Error(
          "Training diverged. Reduce learning rate or clean numeric values.",
        );
    }
  }
}

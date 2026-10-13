/**
 * Variance of the 4-neighbour Laplacian over a greyscale image. Sharp edges produce large
 * second derivatives, so a low variance means there's little fine detail, i.e. blur.
 */
export function laplacianVariance(pixels: Uint8Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumOfSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value =
        (pixels[i - width] ?? 0) +
        (pixels[i + width] ?? 0) +
        (pixels[i - 1] ?? 0) +
        (pixels[i + 1] ?? 0) -
        4 * (pixels[i] ?? 0);
      sum += value;
      sumOfSquares += value * value;
      count++;
    }
  }

  const mean = sum / count;
  return sumOfSquares / count - mean * mean;
}

export function mirrorNormalizedBoxX(x: number, width: number): number {
  return 1 - x - width;
}

export function mirrorHorizontal(value: number): number {
  return -value;
}

export function drawMirroredImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
): void {
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(image, 0, 0, width, height);
  context.restore();
}

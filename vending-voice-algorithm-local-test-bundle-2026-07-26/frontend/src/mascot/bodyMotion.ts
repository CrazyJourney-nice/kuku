export function amplifyBodyMotion(value: number): number {
  const clamped = Math.min(1, Math.max(0, Math.abs(value)));
  return Math.sign(value) * Math.pow(clamped, 0.45);
}

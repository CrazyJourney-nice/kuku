export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampUnit = (value: number): number => clamp(value, -1, 1);

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const applyDeadZone = (value: number, deadZone: number): number => {
  const magnitude = Math.abs(value);
  if (magnitude <= deadZone) return 0;
  return Math.sign(value) * ((magnitude - deadZone) / (1 - deadZone));
};

export const damp = (
  current: number,
  target: number,
  deltaMs: number,
  responseMs: number,
): number => {
  if (responseMs <= 0 || deltaMs <= 0) {
    return responseMs <= 0 ? target : current;
  }
  const alpha = 1 - Math.exp(-deltaMs / responseMs);
  return current + (target - current) * alpha;
};

export const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

export type ParticleHandoffTarget = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  size: number;
};

export type ParticlePointerSample = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  touch: boolean;
};

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothstep(value: number) {
  const amount = clamp(value, 0, 1);
  return amount * amount * (3 - 2 * amount);
}

/** One cursor force field shared by the loader, handoff, and image clouds. */
export function getParticlePointerDistortion(
  particleX: number,
  particleY: number,
  time: number,
  width: number,
  pointer: ParticlePointerSample,
) {
  const dx = particleX - pointer.x;
  const dy = particleY - pointer.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const radius = pointer.touch && width < 760 ? 170 : 195;
  const force = smoothstep((radius - distance) / radius);
  if (force <= 0) return { x: 0, y: 0, force: 0 };

  const normalX = dx / distance;
  const normalY = dy / distance;
  const ring = Math.sin(distance * 0.092 - time * 0.01) * force * 9;
  const lens = force * force * (pointer.touch ? 70 : 58);
  const twist = force * (pointer.touch ? 23 : 27);
  const velocityInfluence = pointer.touch ? 0.46 : 0.68;
  return {
    x:
      normalX * (lens + ring) - normalY * twist +
      pointer.vx * force * velocityInfluence,
    y:
      normalY * (lens + ring) + normalX * twist +
      pointer.vy * force * velocityInfluence,
    force,
  };
}

function getPerformanceScale(width: number) {
  if (typeof navigator === "undefined") return 0.72;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  let scale = 1;

  if (cores <= 2) scale = 0.5;
  else if (cores <= 4) scale = 0.68;
  else if (cores <= 6) scale = 0.84;

  if (typeof memory === "number") {
    if (memory <= 2) scale = Math.min(scale, 0.5);
    else if (memory <= 4) scale = Math.min(scale, 0.72);
  }

  const dpr = window.devicePixelRatio || 1;
  if (width < 760 && dpr >= 2.5) scale = Math.min(scale, 0.76);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    scale = Math.min(scale, 0.55);
  }

  return scale;
}

/** The loader and every scene resolve the same hardware-aware particle count. */
export function getParticleBudget(width: number) {
  const base = width < 760 ? 6000 : width < 1200 ? 9000 : 12000;
  const minimum = width < 760 ? 3000 : width < 1200 ? 4500 : 6000;
  return Math.max(
    minimum,
    Math.round((base * getPerformanceScale(width)) / 250) * 250,
  );
}

export function getLoaderParticleBudget(width: number) {
  // The loader is transient and overlaps the much denser portrait renderer
  // during handoff. A smaller cloud keeps that overlap inside one frame while
  // the larger pixels preserve the same apparent coverage.
  const performanceScale = getPerformanceScale(width);
  const base = width < 760 ? 3000 : width < 1200 ? 3600 : 4200;
  const minimum = width < 760 ? 2200 : 3000;
  return Math.max(
    minimum,
    Math.round((base * performanceScale) / 200) * 200,
  );
}

/** Denser image clouds, still scaled down automatically for weaker hardware. */
export function getPortraitParticleBudget(width: number) {
  const performanceScale = getPerformanceScale(width);
  const densityMultiplier = performanceScale >= 0.95
    ? 1.2
    : performanceScale >= 0.78
      ? 1.1
      : performanceScale >= 0.62
        ? 1.02
        : 0.96;
  return Math.round((getParticleBudget(width) * densityMultiplier) / 250) * 250;
}

export function getParticlePixelSize(width: number) {
  if (width < 760) return 5.9;
  if (width < 1200) return 6.8;
  return 7.5;
}

export function getParticleCanvasDpr(width: number, maximum: number) {
  const scale = getPerformanceScale(width);
  const capabilityLimit = scale <= 0.55
    ? 1.25
    : scale <= 0.75
      ? 1.5
      : scale < 0.95
        ? 1.75
        : maximum;
  return Math.min(window.devicePixelRatio || 1, maximum, capabilityLimit);
}

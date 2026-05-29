import type { SpatialPoint } from '../data/types';

export type IconPhysics = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sway: number;
};

export type PhysicsConfig = {
  springK: number;
  springD: number;
  coastD: number;
  swayFactor: number;
  maxSway: number;
  swaySmooth: number;
};

export const DEFAULT_PHYSICS: PhysicsConfig = {
  springK: 110,
  springD: 19,
  coastD: 6.5,
  swayFactor: 0.45,
  maxSway: 0.22,
  swaySmooth: 26,
};

export function clampPoint(point: SpatialPoint): SpatialPoint {
  return {
    x: Math.max(-1, Math.min(1, point.x)),
    y: Math.max(0.05, Math.min(1, point.y)),
  };
}

export function createPhysics(position: SpatialPoint): IconPhysics {
  return {
    x: position.x,
    y: position.y,
    vx: 0,
    vy: 0,
    sway: 0,
  };
}

export function stepPhysics(
  state: IconPhysics,
  target: SpatialPoint | null,
  dt: number,
  config: PhysicsConfig = DEFAULT_PHYSICS,
): IconPhysics {
  let ax: number;
  let ay: number;

  if (target) {
    ax = (target.x - state.x) * config.springK - state.vx * config.springD;
    ay = (target.y - state.y) * config.springK - state.vy * config.springD;
  } else {
    ax = -state.vx * config.coastD;
    ay = -state.vy * config.coastD;
  }

  const vx = state.vx + ax * dt;
  const vy = state.vy + ay * dt;
  const clamped = clampPoint({
    x: state.x + vx * dt,
    y: state.y + vy * dt,
  });

  const targetSway = Math.max(
    -config.maxSway,
    Math.min(config.maxSway, vx * config.swayFactor),
  );
  const swayBlend = 1 - Math.exp(-config.swaySmooth * dt);
  const sway = state.sway + (targetSway - state.sway) * swayBlend;

  return {
    x: clamped.x,
    y: clamped.y,
    vx: Math.abs(vx) < 0.0001 ? 0 : vx,
    vy: Math.abs(vy) < 0.0001 ? 0 : vy,
    sway: Math.abs(sway) < 0.0001 && Math.abs(targetSway) < 0.0001 ? 0 : sway,
  };
}

export function isSettled(state: IconPhysics, target: SpatialPoint | null): boolean {
  if (target) return false;
  const speed = Math.hypot(state.vx, state.vy);
  return speed < 0.012 && Math.abs(state.sway) < 0.012;
}

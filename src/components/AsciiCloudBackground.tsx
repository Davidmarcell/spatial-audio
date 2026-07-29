import { useEffect, useRef } from 'react';
import styles from './AsciiCloudBackground.module.css';

const WIDTH = 1920;
const HEIGHT = 1080;

/** Monospace cell size — dense enough for a soft cloud, sparse enough to read as glyphs. */
const CELL_W = 10;
const CELL_H = 12;
const COLS = Math.floor(WIDTH / CELL_W);
const ROWS = Math.floor(HEIGHT / CELL_H);

const GLYPHS =
  'ilI1!|:;.,`\'-~_+*=<>?/\\[]{}()@#%&$QqWwEeRrTtYyUuOoPpAaSsDdFfGgHhJjKkLlZzXxCcVvBbNnMm0123456789';

const DENSE = '@#%&WM8B$0Q';
const MID = 'XxZzYynmuawo';
const LIGHT = 'ilI1!;:.,`\'-~';

type Cell = {
  ch: string;
  density: number;
  phase: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

function hash2(x: number, y: number, seed: number) {
  let n = x * 374761393 + y * 668265263 + seed * 982451653;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function cloudDensity(nx: number, ny: number, seed: number) {
  // Compact vertical spindle — leaves room for section content + matches refs
  const dx = (nx - 0.5) / 0.105;
  const dy = (ny - 0.46) / 0.24;
  let d = Math.exp(-(dx * dx * 1.15 + dy * dy));

  const dx2 = (nx - 0.53) / 0.08;
  const dy2 = (ny - 0.6) / 0.15;
  d += 0.55 * Math.exp(-(dx2 * dx2 + dy2 * dy2));

  const dx3 = (nx - 0.45) / 0.06;
  const dy3 = (ny - 0.36) / 0.08;
  d += 0.28 * Math.exp(-(dx3 * dx3 + dy3 * dy3));

  const n1 = hash2(Math.floor(nx * 40), Math.floor(ny * 40), seed);
  const n2 = hash2(Math.floor(nx * 90), Math.floor(ny * 90), seed + 7);
  d *= 0.7 + 0.3 * n1;
  d -= 0.14 * n2;

  return Math.max(0, Math.min(1, d));
}

function pickGlyph(density: number, x: number, y: number, seed: number, t: number) {
  const flicker = hash2(x, y, seed + Math.floor(t * 2.2));
  const roll = hash2(x, y, seed + 99) + flicker * 0.08;
  if (density > 0.72) {
    return DENSE[Math.floor(roll * DENSE.length) % DENSE.length]!;
  }
  if (density > 0.42) {
    return MID[Math.floor(roll * MID.length) % MID.length]!;
  }
  if (density > 0.18) {
    return LIGHT[Math.floor(roll * LIGHT.length) % LIGHT.length]!;
  }
  if (density > 0.06 && roll > 0.55) {
    return GLYPHS[Math.floor(roll * GLYPHS.length) % GLYPHS.length]!;
  }
  return ' ';
}

function sampleColor(nx: number, ny: number, density: number) {
  const warm = { r: 255, g: 196, b: 72 };
  const ember = { r: 232, g: 92, b: 48 };
  const rose = { r: 168, g: 48, b: 64 };
  const teal = { r: 56, g: 196, b: 176 };
  const cyan = { r: 64, g: 140, b: 220 };
  const green = { r: 72, g: 180, b: 110 };

  const v = smoothstep(0.22, 0.72, ny);
  let r: number;
  let g: number;
  let b: number;

  if (v < 0.35) {
    const t = v / 0.35;
    r = warm.r + (ember.r - warm.r) * t;
    g = warm.g + (ember.g - warm.g) * t;
    b = warm.b + (ember.b - warm.b) * t;
  } else if (v < 0.55) {
    const t = (v - 0.35) / 0.2;
    r = ember.r + (rose.r - ember.r) * t;
    g = ember.g + (rose.g - ember.g) * t;
    b = ember.b + (rose.b - ember.b) * t;
  } else if (v < 0.75) {
    const t = (v - 0.55) / 0.2;
    const midR = rose.r + (green.r - rose.r) * t;
    const midG = rose.g + (green.g - rose.g) * t;
    const midB = rose.b + (green.b - rose.b) * t;
    r = midR + (teal.r - midR) * t;
    g = midG + (teal.g - midG) * t;
    b = midB + (teal.b - midB) * t;
  } else {
    const t = (v - 0.75) / 0.25;
    r = teal.r + (cyan.r - teal.r) * t;
    g = teal.g + (cyan.g - teal.g) * t;
    b = teal.b + (cyan.b - teal.b) * t;
  }

  const hx = (nx - 0.5) * 2;
  r = Math.min(255, r + Math.max(0, -hx) * 18);
  b = Math.min(255, b + Math.max(0, hx) * 28);
  g = Math.min(255, g + Math.max(0, hx) * 8);

  const core = smoothstep(0.45, 0.95, density) * (1 - Math.abs(ny - 0.4) * 1.4);
  const lift = Math.max(0, core) * 0.65;
  r = r + (255 - r) * lift;
  g = g + (245 - g) * lift * 0.9;
  b = b + (210 - b) * lift * 0.55;

  const alpha = smoothstep(0.04, 0.85, density) * (0.35 + density * 0.65);
  return { r, g, b, a: alpha };
}

function buildGrid(seed: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < ROWS; y += 1) {
    const row: Cell[] = [];
    for (let x = 0; x < COLS; x += 1) {
      const nx = (x + 0.5) / COLS;
      const ny = (y + 0.5) / ROWS;
      const density = cloudDensity(nx, ny, seed);
      const color = sampleColor(nx, ny, density);
      row.push({
        ch: pickGlyph(density, x, y, seed, 0),
        density,
        phase: hash2(x, y, seed + 3) * Math.PI * 2,
        ...color,
      });
    }
    grid.push(row);
  }
  return grid;
}

function paintGlyphs(
  ctx: CanvasRenderingContext2D,
  grid: Cell[][],
  markerAlpha: number,
) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.font = `500 ${CELL_H - 1}px "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Lone marker above the mist (reference composition)
  ctx.fillStyle = `rgba(236, 240, 244, ${markerAlpha})`;
  ctx.fillText('x', WIDTH * 0.5, HEIGHT * 0.16);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = grid[y]![x]!;
      if (cell.density < 0.05 || cell.ch === ' ' || cell.a < 0.04) continue;
      ctx.fillStyle = `rgba(${cell.r | 0}, ${cell.g | 0}, ${cell.b | 0}, ${cell.a})`;
      ctx.fillText(cell.ch, x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2);
    }
  }
}

type Props = {
  className?: string;
  /** Disable animation (static frame) */
  static?: boolean;
  seed?: number;
};

/**
 * 1920×1080 glowing ASCII cloud — dark void, warm ember → cool teal spectrum,
 * feathered density. Designed as a full-bleed section background.
 */
export function AsciiCloudBackground({
  className,
  static: isStatic = false,
  seed = 42,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const grid = buildGrid(seed);
    const glyphLayer = document.createElement('canvas');
    glyphLayer.width = WIDTH;
    glyphLayer.height = HEIGHT;
    const glyphCtx = glyphLayer.getContext('2d');
    if (!glyphCtx) return;

    const fringe: Array<{ x: number; y: number }> = [];
    const core: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const d = grid[y]![x]!.density;
        if (d >= 0.06 && d < 0.35) fringe.push({ x, y });
        else if (d > 0.7) core.push({ x, y });
      }
    }

    let raf = 0;
    const start = performance.now();
    let lastShimmer = -1;

    paintGlyphs(glyphCtx, grid, 0.62);

    const compose = (breath: number) => {
      const bg = ctx.createRadialGradient(
        WIDTH * 0.5,
        HEIGHT * 0.42,
        40,
        WIDTH * 0.5,
        HEIGHT * 0.5,
        HEIGHT * 0.85,
      );
      bg.addColorStop(0, '#0a0c10');
      bg.addColorStop(0.55, '#050608');
      bg.addColorStop(1, '#020203');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const warmGlow = ctx.createRadialGradient(
        WIDTH * 0.48,
        HEIGHT * 0.36,
        10,
        WIDTH * 0.48,
        HEIGHT * 0.38,
        280 + breath * 40,
      );
      warmGlow.addColorStop(0, `rgba(255, 190, 70, ${0.16 + breath * 0.05})`);
      warmGlow.addColorStop(0.45, `rgba(220, 80, 40, ${0.07 + breath * 0.025})`);
      warmGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = warmGlow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const coolGlow = ctx.createRadialGradient(
        WIDTH * 0.54,
        HEIGHT * 0.58,
        8,
        WIDTH * 0.54,
        HEIGHT * 0.6,
        260 + breath * 30,
      );
      coolGlow.addColorStop(0, `rgba(60, 200, 190, ${0.12 + breath * 0.04})`);
      coolGlow.addColorStop(0.5, `rgba(50, 120, 210, ${0.06 + breath * 0.02})`);
      coolGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coolGlow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const coreGlow = ctx.createRadialGradient(
        WIDTH * 0.5,
        HEIGHT * 0.4,
        4,
        WIDTH * 0.5,
        HEIGHT * 0.42,
        120 + breath * 20,
      );
      coreGlow.addColorStop(0, `rgba(255, 240, 200, ${0.1 + breath * 0.04})`);
      coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();

      // Soft bloom under sharp glyphs — luminous mist, not hard terminal text
      ctx.save();
      ctx.filter = 'blur(6px)';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(glyphLayer, 0, 0);
      ctx.filter = 'blur(18px)';
      ctx.globalAlpha = 0.28;
      ctx.drawImage(glyphLayer, 0, 0);
      ctx.restore();

      ctx.drawImage(glyphLayer, 0, 0);

      const vig = ctx.createRadialGradient(
        WIDTH * 0.5,
        HEIGHT * 0.45,
        HEIGHT * 0.2,
        WIDTH * 0.5,
        HEIGHT * 0.5,
        HEIGHT * 0.78,
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    };

    const draw = (now: number) => {
      const elapsed = (now - start) / 1000;
      const breath = reducedMotion || isStatic ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 0.35);
      const shimmerBucket = Math.floor(elapsed * 2.4);

      if (!isStatic && !reducedMotion && shimmerBucket !== lastShimmer) {
        lastShimmer = shimmerBucket;
        for (let i = 0; i < fringe.length; i += 7) {
          const { x, y } = fringe[i]!;
          const cell = grid[y]![x]!;
          const shimmer = 0.5 + 0.5 * Math.sin(elapsed * 1.1 + cell.phase);
          if (shimmer > 0.78) {
            cell.ch = pickGlyph(cell.density, x, y, seed, elapsed);
          }
        }
        for (let i = 0; i < core.length; i += 11) {
          const { x, y } = core[i]!;
          const cell = grid[y]![x]!;
          if (Math.sin(elapsed * 0.7 + cell.phase) > 0.96) {
            cell.ch = pickGlyph(cell.density, x, y, seed + 11, elapsed);
          }
        }
        paintGlyphs(glyphCtx, grid, 0.55 + breath * 0.15);
      }

      compose(breath);

      if (!isStatic && !reducedMotion) {
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isStatic, seed]);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} width={WIDTH} height={HEIGHT} />
      <div className={styles.grain} />
    </div>
  );
}


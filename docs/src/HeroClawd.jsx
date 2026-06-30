import React, { useEffect, useRef } from 'react';

const BODY = [
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
];

const EYES = {
  forward: { left: { dx: 0, dy: 0 }, right: { dx: 0, dy: 0 } },
  look_right: { left: { dx: 1, dy: 0 }, right: { dx: 1, dy: 0 } },
  look_left: { left: { dx: -1, dy: 0 }, right: { dx: -1, dy: 0 } },
  look_down: { left: { dx: 0, dy: 1 }, right: { dx: 0, dy: 1 } },
  blink: { type: 'hidden' },
};

const EYE_LEFT = { x: 4, y: 1 };
const EYE_RIGHT = { x: 9, y: 1 };
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 760;
const PIXEL_SIZE = 10;
const LOOP_DURATION_MS = 7200;
const RUNNERS = [
  { phase: 0, homeX: 3, farX: 99, baseY: 1, restEyes: 'look_right' },
  { phase: 0.15, homeX: 19, farX: 93, baseY: 11, restEyes: 'forward' },
  { phase: 0.29, homeX: 8, farX: 101, baseY: 21, restEyes: 'look_left' },
  { phase: 0.43, homeX: 25, farX: 88, baseY: 31, restEyes: 'look_right' },
  { phase: 0.57, homeX: 5, farX: 82, baseY: 41, restEyes: 'forward' },
  { phase: 0.71, homeX: 15, farX: 97, baseY: 51, restEyes: 'look_left' },
  { phase: 0.86, homeX: 31, farX: 104, baseY: 61, restEyes: 'look_right' },
];
const PALETTE = {
  body: '#CD6E58',
  eye: '#000000',
  dust: '#73E2A7',
  dustSoft: 'rgb(115 226 167 / 0.42)',
  shadow: 'rgb(0 0 0 / 0.36)',
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawPixel(ctx, size, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x * size), Math.round(y * size), size, size);
}

function drawClawd(ctx, size, ox, oy, eyes = 'forward') {
  for (let row = 0; row < BODY.length; row += 1) {
    for (let col = 0; col < BODY[row].length; col += 1) {
      if (BODY[row][col]) {
        drawPixel(ctx, size, ox + col, oy + row, PALETTE.body);
      }
    }
  }

  const eye = EYES[eyes];
  if (!eye || eye.type === 'hidden') return;

  drawPixel(ctx, size, ox + EYE_LEFT.x + eye.left.dx, oy + EYE_LEFT.y + eye.left.dy, PALETTE.eye);
  drawPixel(ctx, size, ox + EYE_RIGHT.x + eye.right.dx, oy + EYE_RIGHT.y + eye.right.dy, PALETTE.eye);
}

function getPhase(t) {
  if (t < 0.16) return { name: 'look', progress: t / 0.16 };
  if (t < 0.38) return { name: 'dash', progress: (t - 0.16) / 0.22 };
  if (t < 0.52) return { name: 'turn', progress: (t - 0.38) / 0.14 };
  if (t < 0.76) return { name: 'return', progress: (t - 0.52) / 0.24 };
  return { name: 'settle', progress: (t - 0.76) / 0.24 };
}

function resolvePose(t, reducedMotion, runner) {
  if (reducedMotion) {
    return {
      x: Math.round(lerp(runner.homeX, runner.farX, 0.24 + runner.phase * 0.3)),
      y: runner.baseY,
      eyes: runner.restEyes,
      dustDir: 0,
      speed: 0,
    };
  }

  const { name, progress } = getPhase(t);
  const { homeX, farX, baseY } = runner;

  if (name === 'look') {
    return {
      x: homeX,
      y: baseY + (progress > 0.2 && progress < 0.44 ? -1 : 0),
      eyes: progress > 0.42 && progress < 0.56 ? 'blink' : progress > 0.7 ? 'look_right' : 'forward',
      dustDir: 0,
      speed: 0,
    };
  }

  if (name === 'dash') {
    return {
      x: Math.round(lerp(homeX, farX, easeInOut(progress))),
      y: baseY + (Math.sin(progress * Math.PI * 8) > 0 ? -1 : 0),
      eyes: 'look_right',
      dustDir: -1,
      speed: progress < 0.08 || progress > 0.92 ? 0.45 : 1,
    };
  }

  if (name === 'turn') {
    return {
      x: farX,
      y: baseY + (Math.sin(progress * Math.PI) > 0.1 ? -1 : 0),
      eyes: progress < 0.34 ? 'look_right' : progress < 0.58 ? 'blink' : 'look_left',
      dustDir: 0,
      speed: 0,
    };
  }

  if (name === 'return') {
    return {
      x: Math.round(lerp(farX, homeX, easeInOut(progress))),
      y: baseY + (Math.sin(progress * Math.PI * 8) > 0 ? -1 : 0),
      eyes: 'look_left',
      dustDir: 1,
      speed: progress < 0.08 || progress > 0.92 ? 0.45 : 1,
    };
  }

  return {
    x: homeX,
    y: baseY + (Math.sin(progress * Math.PI * 2) > 0.6 ? -1 : 0),
    eyes: progress > 0.3 && progress < 0.42 ? 'look_down' : progress > 0.68 && progress < 0.78 ? 'blink' : 'forward',
    dustDir: 0,
    speed: 0,
  };
}

function drawDust(ctx, size, x, y, t, direction, speed) {
  if (!direction || speed <= 0) return;

  const baseX = direction < 0 ? x + 3 : x + 11;
  const pulse = Math.floor(t * 30) % 4;
  const opacity = clamp01(speed);

  ctx.globalAlpha = opacity;
  drawPixel(ctx, size, baseX - direction * (2 + pulse), y + 8, PALETTE.dust);
  ctx.globalAlpha = opacity * 0.7;
  drawPixel(ctx, size, baseX - direction * (5 + pulse), y + 7, PALETTE.dustSoft);
  ctx.globalAlpha = opacity * 0.45;
  drawPixel(ctx, size, baseX - direction * (7 + pulse), y + 9, PALETTE.dustSoft);
  ctx.globalAlpha = 1;
}

function drawRunner(ctx, size, t, pose, reducedMotion) {
  const ox = Math.round(pose.x);
  const oy = Math.round(pose.y);

  ctx.save();
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(
    (ox + 7) * size,
    (oy + 8.5) * size,
    6.1 * size,
    (reducedMotion ? 0.8 : 0.66 + Math.sin(t * Math.PI * 18) * 0.09) * size,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  drawDust(ctx, size, ox, oy, t, pose.dustDir, pose.speed);
  drawClawd(ctx, size, ox, oy, pose.eyes);
}

function drawFrame(ctx, width, height, elapsedMs, reducedMotion) {
  const progress = reducedMotion ? 0.18 : (elapsedMs % LOOP_DURATION_MS) / LOOP_DURATION_MS;

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;

  for (const runner of RUNNERS) {
    const t = reducedMotion ? progress : (progress + runner.phase) % 1;
    drawRunner(ctx, PIXEL_SIZE, t, resolvePose(t, reducedMotion, runner), reducedMotion);
  }
}

export function HeroClawd() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frameId;
    let startedAt;

    function render(now) {
      if (startedAt == null) startedAt = now;
      drawFrame(ctx, canvas.width, canvas.height, now - startedAt, reduceQuery.matches);
      if (!reduceQuery.matches) {
        frameId = window.requestAnimationFrame(render);
      }
    }

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="hero-clawd" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="hero-clawd-canvas"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
    </div>
  );
}

<script>
  import { onMount } from "svelte";
  import { gameStore } from "../lib/gameStore.svelte.js";
  import { PIECE_ORIENTATIONS, PIECE_THEMES } from "../lib/game.js";

  /**
   * @prop {number} cellSize - size of each grid cell in px
   */
  let { cellSize = 55 } = $props();

  let canvas = $state(null);
  let animationId = null;
  let particles = [];

  // ----- Particle physics config ------
  const GRAVITY = 0.52;      // px/frame²
  const TRAIL_LENGTH = 28;   // ghost copies per particle — longer = more persistent trail
  const BLOCK_GAP = 1;       // gap between adjacent cells (mirrors the CSS grid gap)

  /**
   * Build one particle per *placed piece* — the whole tetromino moves as a unit.
   * `shape` is the array of [row, col] offsets so all blocks render relative to
   * the particle's origin (top-left of the piece bounding box on screen).
   */
  function buildParticles() {
    const boardEl = document.getElementById("puzzle-board");
    if (!boardEl) return [];

    const boardRect = boardEl.getBoundingClientRect();
    const result = [];

    for (const piece of gameStore.placedPieces) {
      const theme = PIECE_THEMES[piece.id] || { color: "#888" };
      const rotations = PIECE_ORIENTATIONS[piece.id] || [];
      const shape = rotations[piece.rotationIndex % rotations.length] || [];

      // Screen position of the piece origin (top-left of its bounding box)
      const ox = boardRect.left + 8 + piece.col * cellSize;
      const oy = boardRect.top  + 8 + piece.row * cellSize;

      // Alternate pieces left / right, each within a ±45° cone of horizontal
      const goRight = result.length % 2 === 0;
      const coneCenter = goRight ? 0 : Math.PI;           // 0 = right, π = left
      const spread = (Math.PI / 4) * (0.3 + Math.random() * 0.7); // 0–45° deviation
      const angle = coneCenter + (Math.random() > 0.5 ? spread : -spread);
      const speed = 9 + Math.random() * 10;

      result.push({
        x:  ox,
        y:  oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (3 + Math.random() * 5),
        color: theme.color,
        shape,           // [{r,c}…] — kept as-is, relative offsets never change
        alpha: 1,
        trail: [],       // array of { x, y, alpha }
      });
    }
    return result;
  }

  /** Draw one full tetromino shape at position (ox, oy) with given alpha. */
  function drawPiece(ctx, ox, oy, shape, color, alpha, scale = 1) {
    const bs = (cellSize - BLOCK_GAP) * scale; // block size
    const gap = BLOCK_GAP * scale;
    const cornerR = Math.min(5, bs * 0.18);

    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;

    for (const [br, bc] of shape) {
      const bx = ox + bc * (bs + gap);
      const by = oy + br * (bs + gap);
      roundRect(ctx, bx, by, bs, bs, cornerR);
      ctx.fill();
    }

    // Subtle top-left highlight glint
    ctx.fillStyle = "white";
    ctx.globalAlpha = alpha * 0.12;
    for (const [br, bc] of shape) {
      const bx = ox + bc * (bs + gap);
      const by = oy + br * (bs + gap);
      roundRect(ctx, bx + 1, by + 1, bs * 0.44, bs * 0.26, 2);
      ctx.fill();
    }
  }

  function tick(ctx, w, h) {
    // Very slow partial clear — trail lingers like a comet tail
    ctx.fillStyle = "rgba(240, 234, 227, 0.055)";
    ctx.fillRect(0, 0, w, h);

    let allGone = true;

    for (const p of particles) {
      if (p.alpha <= 0) continue;
      allGone = false;

      // Record current position for trail before moving
      p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

      // Draw trail ghosts oldest → newest — recent copies nearly opaque, old ones gentle
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        const frac = i / p.trail.length;           // 0 = oldest, 1 = newest
        const trailAlpha = t.alpha * (0.08 + frac * 0.85);
        drawPiece(ctx, t.x, t.y, p.shape, p.color, trailAlpha, 1);
      }

      // Draw the piece at its current position (full opacity / full size)
      drawPiece(ctx, p.x, p.y, p.shape, p.color, p.alpha, 1);

      // Physics step
      p.vy += GRAVITY;
      p.x  += p.vx;
      p.y  += p.vy;

      // Rough bounding box of the piece to detect screen edges
      const pieceW = (Math.max(...p.shape.map(([, c]) => c)) + 1) * cellSize;
      const pieceH = (Math.max(...p.shape.map(([r]) => r)) + 1) * cellSize;

      // Bounce horizontally
      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx);
      } else if (p.x + pieceW > w) {
        p.x = w - pieceW;
        p.vx = -Math.abs(p.vx);
      }

      // Bounce vertically
      if (p.y < 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy);
      } else if (p.y + pieceH > h) {
        p.y = h - pieceH;
        p.vy = -Math.abs(p.vy);
      }
    }

    ctx.globalAlpha = 1;
    return allGone;
  }

  /** Canvas rounded-rect helper (works in all browsers) */
  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  function startAnimation() {
    if (!canvas) return;
    stopAnimation();

    const ctx = canvas.getContext("2d");
    const w   = canvas.width;
    const h   = canvas.height;

    particles = buildParticles();
    if (particles.length === 0) return;

    ctx.clearRect(0, 0, w, h);

    function loop() {
      const done = tick(ctx, w, h);
      if (!done) {
        animationId = requestAnimationFrame(loop);
      } else {
        ctx.clearRect(0, 0, w, h);
        animationId = null;
      }
    }
    animationId = requestAnimationFrame(loop);
  }

  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    particles = [];
  }

  // Resize canvas to match window
  function syncSize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  onMount(() => {
    syncSize();
    window.addEventListener("resize", syncSize);
    return () => {
      window.removeEventListener("resize", syncSize);
      stopAnimation();
    };
  });

  // React to isWinning toggling
  $effect(() => {
    if (gameStore.isWinning) {
      startAnimation();
    } else {
      stopAnimation();
    }
  });
</script>

<!-- Fixed full-screen canvas, pointer-events:none so it doesn't block interaction -->
<canvas
  bind:this={canvas}
  class="win-bounce-canvas"
  aria-hidden="true"
></canvas>

<style>
  .win-bounce-canvas {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: none;
  }
</style>

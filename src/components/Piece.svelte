<script>
import { PIECE_ORIENTATIONS, PIECE_THEMES } from "../lib/game.js";
import { gameStore } from "../lib/gameStore.svelte.js";

let {
  pieceId,
  rotationIndex,
  onBoard = false,
  cellSize = 45,
  hitboxSize = 0,
  isDragging = false,
} = $props();

const theme = $derived(
  PIECE_THEMES[pieceId] || { bg: "bg-neutral", color: "#888", name: "Piece" },
);
const rotations = $derived(PIECE_ORIENTATIONS[pieceId] || []);
const shape = $derived(rotations[rotationIndex % rotations.length] || []);

// Compute bounding box dimensions of the piece
const maxR = $derived(Math.max(...shape.map(([r]) => r), 0));
const maxC = $derived(Math.max(...shape.map(([_, c]) => c), 0));
const rows = $derived(maxR + 1);
const cols = $derived(maxC + 1);

// Check if a block exists at local (r, c)
function hasBlock(r, c) {
  return shape.some(([sr, sc]) => sr === r && sc === c);
}

// Round a corner only when it lies on the piece's outer boundary, so adjacent
// cells join seamlessly (classic Tetris look) while the outline stays soft.
// A corner is rounded when at least one orthogonal neighbour is empty (keeps
// straight edges gently scalloped) AND the diagonal cell is empty. When the
// diagonal is filled the corner sits inside a concave notch, so we keep it
// square to avoid the spiky point where two rounded cells meet.
const CORNER_DIRS = {
  tl: { orth: [[-1, 0], [0, -1]], diag: [-1, -1] },
  tr: { orth: [[-1, 0], [0, 1]], diag: [-1, 1] },
  bl: { orth: [[1, 0], [0, -1]], diag: [1, -1] },
  br: { orth: [[1, 0], [0, 1]], diag: [1, 1] },
};
function cornerRadius(r, c, corner) {
  const { orth, diag } = CORNER_DIRS[corner];
  const n1Empty = !hasBlock(r + orth[0][0], c + orth[0][1]);
  const n2Empty = !hasBlock(r + orth[1][0], c + orth[1][1]);
  const diagEmpty = !hasBlock(r + diag[0], c + diag[1]);
  return (n1Empty || n2Empty) && diagEmpty ? "min(7px, 20%)" : "0";
}
function cellRadius(r, c) {
  return [
    cornerRadius(r, c, "tl"),
    cornerRadius(r, c, "tr"),
    cornerRadius(r, c, "br"),
    cornerRadius(r, c, "bl"),
  ].join(" ");
}

// Pointer state for click vs drag
let isPointerDown = false;
let dragStarted = false;
let pendingGrabbedCell = { r: 0, c: 0 };
let startX = 0;
let startY = 0;
let startTime = 0;

function handlePointerDown(e) {
  if (e.button !== 0 && e.pointerType === "mouse") return;

  const blockEl = e.target.closest("[data-block]");
  // Inventory pieces have a generous square hit area. A press in its empty
  // space grabs the first occupied cell, so near-misses still start a drag.
  const r = blockEl ? parseInt(blockEl.dataset.r, 10) : shape[0][0];
  const c = blockEl ? parseInt(blockEl.dataset.c, 10) : shape[0][1];

  isPointerDown = true;
  dragStarted = false;
  startX = e.clientX;
  startY = e.clientY;
  startTime = Date.now();

  // Prevent default selection text behavior
  e.currentTarget.setPointerCapture(e.pointerId);

  // Cache the local grabbed cell for when drag threshold is exceeded.
  pendingGrabbedCell = { r, c };
}

function handlePointerMove(e) {
  if (!isPointerDown) return;

  if (!dragStarted) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= 6) {
      if (onBoard) {
        gameStore.startDragFromBoard(pieceId, pendingGrabbedCell, startX, startY);
      } else {
        gameStore.startDragFromInventory(pieceId, pendingGrabbedCell, startX, startY);
      }
      dragStarted = true;
    }
  }
}

function handlePointerUp(e) {
  if (!isPointerDown) return;
  isPointerDown = false;

  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch (_err) {}

  const duration = Date.now() - startTime;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Click/Tap to rotate (short duration and minimal movement, no active drag)
  if (!dragStarted && dist < 6 && duration < 220) {
    gameStore.rotatePieceClockwise(pieceId, onBoard);
  }

  dragStarted = false;
}

function handleDoubleClick() {
  if (onBoard) {
    gameStore.recallPiece(pieceId);
  }
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="piece-container select-none touch-none inline-block relative cursor-grab active:cursor-grabbing
         {gameStore.shakingPieces.includes(pieceId) ? 'animate-shake' : ''}"
  style="
    width: {hitboxSize || cols * cellSize}px;
    height: {hitboxSize || rows * cellSize}px;
    opacity: {isDragging ? 0.35 : 1};
    transition: transform 0.15s ease-out;
  "
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  ondblclick={handleDoubleClick}
>
  <div
    class="grid gap-0 absolute"
    style="
      width: {cols * cellSize}px;
      height: {rows * cellSize}px;
      left: {hitboxSize ? "50%" : "0"};
      top: {hitboxSize ? "50%" : "0"};
      transform: {hitboxSize ? "translate(-50%, -50%)" : "none"};
      grid-template-rows: repeat({rows}, 1fr);
      grid-template-columns: repeat({cols}, 1fr);
    "
  >
    {#each Array(rows) as _, r}
      {#each Array(cols) as _, c}
        {#if hasBlock(r, c)}
          <div
            data-block
            data-r={r}
            data-c={c}
            class="piece-cell relative overflow-hidden transition-colors duration-150 {theme.bg}"
            style="
              width: {cellSize}px;
              height: {cellSize}px;
              border-radius: {cellRadius(r, c)};
            "
          ></div>
        {:else}
          <div class="w-full h-full bg-transparent"></div>
        {/if}
      {/each}
    {/each}
  </div>
</div>

<style>
  .piece-container {
    /* Improve mobile touch responsiveness */
    -webkit-tap-highlight-color: transparent;
  }

  /* A crisp printed-tile treatment keeps the pieces bright without the old
     inset-shadow, toy-block appearance. */
  .piece-cell {
    border: 1px solid rgb(255 255 255 / 0.42);
    outline: 1px solid rgb(28 25 23 / 0.1);
    outline-offset: -1px;
    background-image: linear-gradient(135deg, rgb(255 255 255 / 0.22) 0 1px, transparent 1px 52%);
  }

</style>

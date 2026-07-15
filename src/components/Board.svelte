<script>
import { GRID_HEIGHT, GRID_WIDTH, isBlockade, validatePlacement } from "../lib/game.js";
import { gameStore } from "../lib/gameStore.svelte.js";
import Piece from "./Piece.svelte";

let { cellSize = 55 } = $props();

// Snapped grid hover coordinates while dragging
const isHoverPlacementValid = $derived.by(() => {
  if (!gameStore.draggedPiece || !gameStore.hoveredCell) return false;
  const { id, rotationIndex } = gameStore.draggedPiece;
  const { r, c } = gameStore.hoveredCell;
  return validatePlacement(id, r, c, rotationIndex, gameStore.blockades, gameStore.placedPieces)
    .valid;
});

// Calculate coordinates of the ghost cells for valid/invalid hover previews
const previewCells = $derived.by(() => {
  if (!gameStore.draggedPiece || !gameStore.hoveredCell) return [];
  const { id, rotationIndex } = gameStore.draggedPiece;
  const { r, c } = gameStore.hoveredCell;
  const res = validatePlacement(
    id,
    r,
    c,
    rotationIndex,
    gameStore.blockades,
    gameStore.placedPieces,
  );
  return res.valid ? res.cells || [] : [];
});

</script>

<div
  id="puzzle-board"
  class="relative select-none border-4 border-stone-300 bg-stone-200/50 shadow-inner p-2 select-none"
  style="
    width: {GRID_WIDTH * cellSize + 16}px;
    height: {GRID_HEIGHT * cellSize + 16}px;
  "
>
  <!-- Board grid background cells -->
  <div
    id="puzzle-grid"
    class="grid gap-1 w-full h-full"
    style="
      grid-template-rows: repeat({GRID_HEIGHT}, 1fr);
      grid-template-columns: repeat({GRID_WIDTH}, 1fr);
    "
  >
    {#each Array(GRID_HEIGHT) as _, r}
      {#each Array(GRID_WIDTH) as _, c}
        {@const blocked = isBlockade(r, c, gameStore.blockades)}
        {@const isPreview = previewCells.some(([pr, pc]) => pr === r && pc === c)}
        <div
          class="relative flex items-center justify-center transition-all duration-150
                 {blocked ? 'bg-transparent' : 'bg-stone-100/90'} 
                 {isPreview ? 'bg-indigo-200/55 outline outline-2 outline-indigo-400' : ''}"
          style="
            width: {cellSize - 4}px;
            height: {cellSize - 4}px;
            box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.04);
          "
        >
          <!-- Blocking pegs use the same tactile square treatment as pieces. -->
          {#if blocked}
            <div
              class="relative w-full h-full rounded-lg bg-stone-700 border-2 border-stone-800 shadow-sm"
              style="
                box-shadow: inset 0 2px 4px rgba(255, 255, 255, 0.4),
                            inset 0 -2px 4px rgba(0, 0, 0, 0.15);
              "
            >
              <div
                class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 bg-current"
                style="width: 25%; height: 25%;"
              ></div>
            </div>
          {:else if !isPreview}
            <!-- Subtle cell center dot to aid alignment alignment -->
            <div class="w-1.5 h-1.5 bg-stone-300/60"></div>
          {/if}
        </div>
      {/each}
    {/each}
  </div>

  <!-- Snapped Placed Pieces -->
  {#each gameStore.placedPieces as piece (piece.id)}
    <div
      class="absolute transition-transform duration-100 ease-out z-10
             {gameStore.hintedPieceId === piece.id ? 'ring-4 ring-success/60 animate-pulse' : ''}
             {gameStore.conflictingPieceId === piece.id ? 'ring-4 ring-error/70 animate-shake' : ''}"
      style="
        left: {piece.col * cellSize + 8}px;
        top: {piece.row * cellSize + 8}px;
      "
    >
      <Piece
        pieceId={piece.id}
        rotationIndex={piece.rotationIndex}
        onBoard={true}
        {cellSize}
      />
      <!-- Double-tap/click hint to recall to inventory -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute -top-1.5 -right-1.5 badge badge-xs badge-neutral border border-white/20 
               shadow-md opacity-0 hover:opacity-100 cursor-pointer p-1"
        onclick={() => gameStore.recallPiece(piece.id)}
        title="Click to remove"
      >
        ✕
      </div>
    </div>
  {/each}

  <!-- snapped ghost preview (semi-transparent) -->
  {#if gameStore.draggedPiece && gameStore.hoveredCell && isHoverPlacementValid}
    {@const piece = gameStore.draggedPiece}
    <div
      class="absolute pointer-events-none opacity-45 z-20 transition-all duration-75"
      style="
        left: {gameStore.hoveredCell.c * cellSize + 8}px;
        top: {gameStore.hoveredCell.r * cellSize + 8}px;
      "
    >
      <Piece
        pieceId={piece.id}
        rotationIndex={piece.rotationIndex}
        onBoard={false}
        {cellSize}
      />
    </div>
  {/if}
</div>

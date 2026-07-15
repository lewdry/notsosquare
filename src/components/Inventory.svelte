<script>
import { gameStore } from "../lib/gameStore.svelte.js";
import Piece from "./Piece.svelte";

let {
  inventoryCellSize = 34,
  pieceIds = ["I", "O", "T", "L", "J", "S", "Z"],
  stacked = false,
  slotSize = 80,
} = $props();

function isPiecePlaced(id) {
  return gameStore.placedPieces.some((p) => p.id === id);
}

function getInventoryPieceRotation(id) {
  const p = gameStore.inventoryPieces.find((item) => item.id === id);
  return p ? p.rotationIndex : 0;
}
</script>

<div class="flex flex-wrap justify-center items-center {stacked ? 'flex-col gap-2' : 'flex-row gap-1'}">
  {#each pieceIds as id (id)}
      {@const placed = isPiecePlaced(id)}
      {@const isDragging = gameStore.draggedPiece && gameStore.draggedPiece.id === id}
      {@const rotIndex = getInventoryPieceRotation(id)}

      <div
        class="relative flex items-center justify-center"
        style="width: {slotSize}px; height: {slotSize}px;"
      >
        {#if placed && !isDragging}
          <div class="w-full h-full"></div>
        {:else}
          <Piece
            pieceId={id}
            rotationIndex={rotIndex}
            onBoard={false}
            cellSize={inventoryCellSize}
            hitboxSize={slotSize}
            {isDragging}
          />
        {/if}
      </div>
  {/each}
</div>

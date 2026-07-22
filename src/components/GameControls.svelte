<script>
import { gameStore } from "../lib/gameStore.svelte.js";

let { boardWidth = 320 } = $props();

function confirmDiscard(action) {
  if (gameStore.placedPieces.length === 0) return true;
  return window.confirm(`${action}? Your current placement will be lost.`);
}

function resetBoard() {
  if (!confirmDiscard("Reset this board")) return;
  gameStore.initLevel({ randomizeLevel: false });
}

function skipPuzzle() {
  if (!confirmDiscard("Skip this puzzle")) return;
  gameStore.initLevel();
}
</script>

<section class="mx-auto px-3 py-1 flex flex-col gap-2" style="width: {boardWidth}px;">
  <div class="flex justify-center gap-2">
    <button
      type="button"
      onclick={resetBoard}
      class="btn btn-ghost btn-sm h-8 min-h-8 font-bold text-stone-600 border border-stone-200/50 hover:bg-stone-100"
    >
      Reset
    </button>
    {#if !gameStore.isNoTMode}
      <button
        type="button"
        onclick={skipPuzzle}
        class="btn btn-ghost btn-sm h-8 min-h-8 font-bold text-stone-600 border border-stone-200/50 hover:bg-stone-100"
      >
        Skip
      </button>
    {/if}
    <button
      type="button"
      onclick={() => gameStore.requestHint()}
      class="btn btn-ghost btn-sm h-8 min-h-8 font-bold text-stone-600 border border-stone-200/50 hover:bg-stone-100"
    >
      Hint
    </button>
  </div>

  {#if gameStore.hintMessage}
    <div
      class="text-center text-xs min-h-4 {gameStore.conflictingPieceId
        ? 'text-error font-semibold'
        : 'text-stone-600'}"
      aria-live="polite"
    >
      {gameStore.hintMessage}
    </div>
  {/if}
</section>

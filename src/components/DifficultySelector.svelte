<script>
import { DIFFICULTIES } from "../lib/game.js";
import { gameStore } from "../lib/gameStore.svelte.js";

let { boardWidth = 320 } = $props();

const labels = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};
</script>

<section class="mx-auto px-3 py-2 flex flex-col gap-2" style="width: {boardWidth}px;">
  <div class="flex items-center justify-between text-[11px] font-bold text-stone-500 px-1">
    <span>Puzzle #{gameStore.puzzleNumber} of {gameStore.totalPuzzleCount}</span>
    <span>Hints {gameStore.hintsUsed}</span>
  </div>

  <div class="join w-full" aria-label="Select difficulty">
    {#each DIFFICULTIES as difficulty}
      <button
        type="button"
        class="join-item btn btn-sm h-8 min-h-8 flex-1 font-bold {gameStore.difficulty === difficulty
          ? 'btn-primary text-white'
          : 'btn-outline border-stone-200 text-stone-600 hover:bg-stone-100'}"
        aria-pressed={gameStore.difficulty === difficulty}
        onclick={() => gameStore.setDifficulty(difficulty)}
      >
        {labels[difficulty]}
      </button>
    {/each}
  </div>

  <div class="flex justify-center gap-2">
    <button
      type="button"
      onclick={() => gameStore.initLevel()}
      class="btn btn-ghost btn-sm h-8 min-h-8 font-bold text-stone-600 border border-stone-200/50 hover:bg-stone-100"
    >
      New Puzzle
    </button>
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

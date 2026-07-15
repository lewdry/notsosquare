<script>
import { onMount } from "svelte";
import { gameStore } from "./lib/gameStore.svelte.js";
import Board from "./components/Board.svelte";
import DifficultySelector from "./components/DifficultySelector.svelte";
import Inventory from "./components/Inventory.svelte";
import Piece from "./components/Piece.svelte";
import { isClientPointInsideRect } from "./lib/dragGeometry.js";
import { GRID_WIDTH } from "./lib/game.js";

// Keep the board and both piece trays on one horizontal line at every viewport size.
let windowWidth = $state(500);
let windowHeight = $state(800);
let availableWidth = $derived(Math.max(windowWidth - 32, 0));
let isMobile = $derived(windowWidth < 640);
let sideColumnWidth = $derived(Math.max(52, Math.min(112, Math.floor(availableWidth * 0.2))));
let cellSize = $derived(isMobile
  ? Math.max(20, Math.min(55, Math.floor((availableWidth - 16) / 5), Math.floor((windowHeight - 205) / 6)))
  : Math.max(24, Math.min(64, Math.floor((availableWidth - sideColumnWidth * 2 - 24) / 5))));
let inventorySlotSize = $derived(
  isMobile ? Math.max(34, Math.min(52, Math.floor((availableWidth - 6) / 7))) : sideColumnWidth,
);
let inventoryCellSize = $derived(
  Math.max(10, Math.min(cellSize * 0.6, (inventorySlotSize - 4) / 4)),
);

onMount(() => {
  gameStore.connectStorage(window.localStorage);
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  const handleResize = () => {
    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;
  };

  const handleGlobalPointerMove = (e) => {
    if (!gameStore.draggedPiece) return;
    const gridEl = document.getElementById("puzzle-grid");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    gameStore.updateDrag(e.clientX, e.clientY, gridRect);
  };

  const handleGlobalPointerUp = (e) => {
    if (!gameStore.draggedPiece) return;
    const gridEl = document.getElementById("puzzle-grid");
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : null;
    gameStore.updateDrag(e.clientX, e.clientY, gridRect);
    const isOverBoard = isClientPointInsideRect(gridRect, e.clientX, e.clientY);

    gameStore.endDrag({ droppedOnBoard: isOverBoard });
  };

  const handleGlobalPointerCancel = () => {
    if (!gameStore.draggedPiece) return;
    gameStore.endDrag();
  };

  window.addEventListener("resize", handleResize);
  window.addEventListener("pointermove", handleGlobalPointerMove);
  window.addEventListener("pointerup", handleGlobalPointerUp);
  window.addEventListener("pointercancel", handleGlobalPointerCancel);

  // Set viewport height on mobile to prevent address bar issues
  const setVh = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  };
  setVh();
  window.addEventListener("resize", setVh);

  return () => {
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("pointermove", handleGlobalPointerMove);
    window.removeEventListener("pointerup", handleGlobalPointerUp);
    window.removeEventListener("pointercancel", handleGlobalPointerCancel);
    window.removeEventListener("resize", setVh);
  };
});

// Confetti state
let confettiParticles = $state([]);

// Generate a burst of confetti when winning
function triggerConfetti() {
  confettiParticles = Array.from({ length: 65 }).map((_, idx) => {
    const colors = [
      "bg-primary",
      "bg-secondary",
      "bg-accent",
      "bg-success",
      "bg-warning",
      "bg-info",
      "bg-error",
    ];
    return {
      id: idx,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: 50 + (Math.random() - 0.5) * 15,
      top: 45 + (Math.random() - 0.5) * 10,
      tx: (Math.random() - 0.5) * 400,
      ty: 150 + Math.random() * 250,
      rot: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.7,
      delay: Math.random() * 0.15,
    };
  });
}

// React to win state to trigger confetti
$effect(() => {
  if (gameStore.showWinCelebration) {
    triggerConfetti();
  } else {
    confettiParticles = [];
  }
});

function handleCloseCelebration() {
  gameStore.showWinCelebration = false;
  gameStore.initLevel();
}
</script>

<main class="h-[100dvh] w-full flex flex-col items-center justify-between px-4 py-2 bg-stone-100/50 overflow-hidden">
  <!-- Header -->
  <header class="w-full max-w-2xl mx-auto flex items-center justify-center text-center mb-2">
    <div class="flex items-center gap-1.5">
      <div class="w-6 h-6 bg-neutral flex items-center justify-center text-white font-black text-base shadow-md">
        Π
      </div>
      <h1 class="text-2xl leading-none font-black tracking-tight text-neutral uppercase">
        Notsosquare
      </h1>
    </div>
  </header>

  <div class="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center gap-2">
    <div class="w-full">
      <DifficultySelector boardWidth={GRID_WIDTH * cellSize + 16} />
    </div>

    <div
      id="piece-inventory"
      class="grid grid-cols-2 items-center justify-items-center gap-1 my-1 sm:flex-1 sm:content-center sm:gap-2"
      style="grid-template-columns: {isMobile ? '1fr' : `${sideColumnWidth}px auto ${sideColumnWidth}px`};"
    >
      <div class="order-2 col-span-2 hidden sm:order-1 sm:col-span-1 sm:block">
        <Inventory
          pieceIds={["T", "O", "J", "L"]}
          stacked
          {inventoryCellSize}
          slotSize={inventorySlotSize}
        />
      </div>

      <div class="order-1 col-span-2 flex justify-center sm:order-2 sm:col-span-1">
        <Board {cellSize} />
      </div>

      <div class="order-3 hidden sm:block">
        <Inventory
          pieceIds={["I", "Z", "S"]}
          stacked
          {inventoryCellSize}
          slotSize={inventorySlotSize}
        />
      </div>

      <div class="order-4 col-span-2 sm:hidden">
        <div class="flex flex-col items-center gap-1">
          <Inventory
            pieceIds={["T", "O", "J", "L"]}
            {inventoryCellSize}
            slotSize={inventorySlotSize}
          />
          <Inventory
            pieceIds={["I", "Z", "S"]}
            {inventoryCellSize}
            slotSize={inventorySlotSize}
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Info -->
  <footer class="w-full max-w-2xl mx-auto text-center mt-2 text-[10px] text-stone-400 select-none">
    By
    <a
      href="https://lewisdryburgh.com"
      target="_blank"
      rel="noreferrer"
      class="underline decoration-stone-300 underline-offset-2 hover:text-stone-600"
    >
      Lewis Dryburgh
    </a>
  </footer>

  <!-- Active absolute dragging piece floating container -->
  {#if gameStore.draggedPiece}
    {@const piece = gameStore.draggedPiece}
    <div
      class="fixed pointer-events-none z-50 transition-transform duration-75 select-none"
      style="
        left: {gameStore.pointerPos.x - (gameStore.grabbedCell.c + 0.5) * cellSize}px;
        top: {gameStore.pointerPos.y - (gameStore.grabbedCell.r + 0.5) * cellSize}px;
        transform: scale(1.05);
        filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.18));
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

  <!-- Celebration Modal / Banner overlay -->
  {#if gameStore.showWinCelebration}
    <!-- Backdrop blur -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in"
      onclick={handleCloseCelebration}
    >
      <!-- Confetti burst rain -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        {#each confettiParticles as p (p.id)}
          <div
            class="absolute {p.color} pointer-events-none"
            style="
              left: {p.left}%;
              top: {p.top}%;
              width: 8px;
              height: 8px;
              transform: translate3d(0, 0, 0) scale({p.scale});
              animation: fall 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              animation-delay: {p.delay}s;
              --tx: {p.tx}px;
              --ty: {p.ty}px;
              --rot: {p.rot}deg;
            "
          ></div>
        {/each}
      </div>

      <!-- Celebration Card -->
      <div
        class="bg-white p-8 max-w-sm w-full text-center shadow-2xl border border-stone-200/50 
               animate-pop-in relative z-50"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="text-4xl mb-3">🎉</div>
        <h2 class="text-2xl font-black text-neutral uppercase tracking-tight">
          Congratulations!
        </h2>
        <p class="text-stone-500 text-sm mt-2 mb-5 px-2">
          You packed puzzle #{gameStore.puzzleNumber} perfectly with {gameStore.hintsUsed}
          {gameStore.hintsUsed === 1 ? "hint" : "hints"}.
        </p>
        
        <button
          onclick={handleCloseCelebration}
          class="btn btn-primary w-full text-white tracking-wide uppercase font-bold"
        >
          Play Again
        </button>
      </div>
    </div>
  {/if}
</main>

<style>
  /* Confetti burst keyframes */
  @keyframes fall {
    0% {
      transform: translate3d(0, 0, 0) rotate(0deg);
      opacity: 1;
    }
    15% {
      transform: translate3d(calc(var(--tx) * 0.35), -60px, 0) rotate(calc(var(--rot) * 0.25deg));
      opacity: 1;
    }
    100% {
      transform: translate3d(var(--tx), var(--ty), 0) rotate(var(--rot));
      opacity: 0;
    }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }
</style>

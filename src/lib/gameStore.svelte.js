import { clientPointToGridCell } from "./dragGeometry.js";
import {
  checkWinCondition,
  findSolutions,
  GRID_HEIGHT,
  GRID_WIDTH,
  getLevels,
  NO_I_GRID_HEIGHT,
  NO_I_PIECE_IDS,
  PIECE_ORIENTATIONS,
  STANDARD_PIECE_IDS,
  validatePlacement,
} from "./game.js";

const PROGRESS_STORAGE_KEY = "notsosquare-progress-v1";
function placementsMatch(a, b) {
  if (a.id !== b.id || a.row !== b.row || a.col !== b.col) return false;
  const rotations = PIECE_ORIENTATIONS[a.id];
  return a.rotationIndex % rotations.length === b.rotationIndex % rotations.length;
}

export class GameStore {
  // Current active selections
  gameMode = $state("no-i");
  currentLevelIndex = $state(0);

  // Placed and inventory pieces
  placedPieces = $state([]);
  inventoryPieces = $state([]);

  // Drag and drop states
  draggedPiece = $state(null); // { id, rotationIndex, origin: 'inventory'|'board', originalRow, originalCol, originalRotationIndex }
  grabbedCell = $state({ r: 0, c: 0 }); // Local block coords that were grabbed
  pointerPos = $state({ x: 0, y: 0 });
  dragStartPos = $state({ x: 0, y: 0 });
  draggedOffset = $state({ x: 0, y: 0 }); // Offset from grab point

  // Hover snap target
  hoveredCell = $state(null); // { r, c } on the board corresponding to grabbedCell

  // Show win celebration overlay
  showWinCelebration = $state(false);
  isWinning = $state(false);
  winTimeout = null;

  // Progressive hint and completion states
  hintsUsed = $state(0);
  hintMessage = $state("");
  hintedPieceId = $state(null);
  conflictingPieceId = $state(null);
  completionKind = $state(null);

  // Persisted completion data, keyed by level ID.
  progress = $state({ completed: {} });
  storage = null;

  // Shake effect triggers
  shakingPieces = $state([]);
  shakeTimeouts = new Set();

  // Cached solve results for the active puzzle.
  solutions = [];

  constructor() {
    this.initLevel();
  }

  // List of puzzles for the current game mode.
  get levelsList() {
    return getLevels(this.gameMode);
  }

  // Active level object
  get activeLevel() {
    const list = this.levelsList;
    return list[this.currentLevelIndex % list.length] || null;
  }

  // Blockades for active level
  get blockades() {
    if (!this.activeLevel) return [];
    return this.activeLevel.blockades || [this.activeLevel.blockade];
  }

  get gridWidth() {
    return GRID_WIDTH;
  }

  get gridHeight() {
    return this.gameMode === "no-i" ? NO_I_GRID_HEIGHT : GRID_HEIGHT;
  }

  get pieceIds() {
    return this.gameMode === "no-i" ? NO_I_PIECE_IDS : STANDARD_PIECE_IDS;
  }

  get isNoIMode() {
    return this.gameMode === "no-i";
  }

  // Solved state
  get isWon() {
    return checkWinCondition(this.placedPieces, this.blockades, this.gameMode);
  }

  // Stable level ID for persistence. It intentionally stays tied to the source
  // catalogue even when the player-facing puzzle sequence is reordered.
  get levelId() {
    return this.activeLevel?.id || 0;
  }

  // The catalogue is stored hardest-to-easiest, so present its reverse order:
  // puzzle 1 is the easiest and the final number is the hardest.
  get puzzleNumber() {
    if (this.gameMode === "no-i") return this.levelId;
    return this.levelId ? this.totalPuzzleCount - this.levelId + 1 : 0;
  }

  get totalPuzzleCount() {
    return this.levelsList.length;
  }

  get completionStatus() {
    if (this.completionKind === "completed") return "Completed";
    if (this.progress.completed[this.progressKey]) return "Completed before";
    if (this.placedPieces.length > 0 || this.hintsUsed > 0) return "In progress";
    return "Not completed";
  }

  get progressKey() {
    return this.gameMode === "no-i" ? `no-i:${this.levelId}` : this.levelId;
  }

  connectStorage(storage) {
    this.storage = storage;

    try {
      const saved = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY));
      if (saved?.completed && typeof saved.completed === "object") {
        this.progress = { completed: saved.completed };
      }
      this.currentLevelIndex = this.pickRandomLevelIndex();
      this.initLevel({ randomizeLevel: false });
    } catch (_error) {
      this.progress = { completed: {} };
    }
  }

  persistProgress() {
    if (!this.storage) return;

    try {
      this.storage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ completed: this.progress.completed }),
      );
    } catch (_error) {
      // Storage may be unavailable or full; gameplay should continue normally.
    }
  }

  // Pick a random puzzle for the current game mode.
  // When possible, avoid repeating the current index.
  pickRandomLevelIndex() {
    const levelsForMode = this.levelsList;
    const len = levelsForMode.length;

    if (len <= 0) return 0;
    if (len === 1) return 0;

    const unsolvedIndexes = levelsForMode
      .map((level, index) =>
        this.progress.completed[this.gameMode === "no-i" ? `no-i:${level.id}` : level.id]
          ? -1
          : index,
      )
      .filter((index) => index >= 0 && index !== this.currentLevelIndex);
    if (unsolvedIndexes.length > 0) {
      return unsolvedIndexes[Math.floor(Math.random() * unsolvedIndexes.length)];
    }

    let nextIndex = Math.floor(Math.random() * len);
    if (nextIndex === this.currentLevelIndex) {
      nextIndex = (nextIndex + 1 + Math.floor(Math.random() * (len - 1))) % len;
    }
    return nextIndex;
  }

  // Initialize/Reset pieces for the active level
  initLevel({ randomizeLevel = true } = {}) {
    if (randomizeLevel) {
      this.currentLevelIndex = this.pickRandomLevelIndex();
    }

    this.placedPieces = [];
    if (this.winTimeout) clearTimeout(this.winTimeout);
    this.winTimeout = null;
    this.isWinning = false;
    this.showWinCelebration = false;
    this.solutions = [];
    this.hintsUsed = 0;
    this.hintMessage = "";
    this.hintedPieceId = null;
    this.conflictingPieceId = null;
    this.completionKind = null;

    // Reset inventory to contain this mode's pieces, each at rotation index 0.
    this.inventoryPieces = this.pieceIds.map((id) => ({
      id,
      rotationIndex: 0,
    }));
  }

  toggleGameMode() {
    this.gameMode = this.gameMode === "standard" ? "no-i" : "standard";
    this.currentLevelIndex = 0;
    this.draggedPiece = null;
    this.hoveredCell = null;
    this.pointerPos = { x: 0, y: 0 };
    this.dragStartPos = { x: 0, y: 0 };
    this.draggedOffset = { x: 0, y: 0 };
    this.grabbedCell = { r: 0, c: 0 };
    for (const timeoutId of this.shakeTimeouts) clearTimeout(timeoutId);
    this.shakeTimeouts.clear();
    this.shakingPieces = [];
    this.initLevel();
  }

  // Trigger the win celebration for the current puzzle.
  handleWin() {
    if (this.showWinCelebration || this.isWinning) return;
    this.completionKind = "completed";
    const previous = this.progress.completed[this.progressKey];
    const bestHints = previous ? Math.min(previous.bestHints, this.hintsUsed) : this.hintsUsed;
    this.progress.completed[this.progressKey] = {
      bestHints,
      completedAt: new Date().toISOString(),
    };
    this.persistProgress();
    this.isWinning = true;
    this.winTimeout = setTimeout(() => {
      this.isWinning = false;
      this.showWinCelebration = true;
      this.winTimeout = null;
    }, 1400);
  }

  getSolutions() {
    if (this.solutions.length === 0) {
      this.solutions = findSolutions(this.blockades, this.gameMode);
    }
    return this.solutions;
  }

  getCompatibleSolution(placements = this.placedPieces) {
    return (
      this.getSolutions().find((solution) =>
        placements.every((placed) =>
          solution.some((candidate) => placementsMatch(placed, candidate)),
        ),
      ) || null
    );
  }

  getClosestSolution() {
    const solutions = this.getSolutions();
    if (solutions.length === 0) return null;

    return solutions.reduce(
      (best, solution) => {
        const score = solution.filter((candidate) =>
          this.placedPieces.some((placed) => placementsMatch(placed, candidate)),
        ).length;
        return score > best.score ? { solution, score } : best;
      },
      { solution: this.solutions[0], score: -1 },
    ).solution;
  }

  getConflictingPiece() {
    for (const piece of this.placedPieces) {
      const withoutPiece = this.placedPieces.filter((placed) => placed.id !== piece.id);
      if (this.getCompatibleSolution(withoutPiece)) return piece;
    }

    const closest = this.getClosestSolution();
    return (
      this.placedPieces.find(
        (placed) => !closest?.some((candidate) => placementsMatch(placed, candidate)),
      ) || this.placedPieces[0]
    );
  }

  requestHint() {
    if (this.isWon) return false;
    this.clearHintFeedback();

    const solution = this.getCompatibleSolution();
    if (!solution) {
      const conflict = this.getConflictingPiece();
      if (!conflict) return false;

      this.hintsUsed += 1;
      this.conflictingPieceId = conflict.id;
      this.hintMessage = `This layout can’t be completed. Try moving the ${conflict.id}-piece.`;
      return true;
    }

    const placement = solution.find(
      (candidate) => !this.placedPieces.some((placed) => placementsMatch(placed, candidate)),
    );
    if (!placement) return false;

    this.placedPieces.push({ ...placement });
    this.inventoryPieces = this.inventoryPieces.filter((piece) => piece.id !== placement.id);
    this.hintsUsed += 1;
    this.hintedPieceId = placement.id;
    this.hintMessage = `Placed the ${placement.id}-piece in a useful position.`;
    if (this.isWon) this.handleWin();
    return true;
  }

  clearHintFeedback() {
    this.hintMessage = "";
    this.hintedPieceId = null;
    this.conflictingPieceId = null;
  }

  // ROTATION ACTIONS
  rotatePieceClockwise(pieceId, onBoard = false) {
    if (this.isWinning) return;
    if (onBoard) {
      // Find placed piece
      const pieceIdx = this.placedPieces.findIndex((p) => p.id === pieceId);
      if (pieceIdx !== -1) {
        const piece = this.placedPieces[pieceIdx];
        const nextRotation = piece.rotationIndex + 1;

        // Validate if it fits rotated
        const otherPieces = this.placedPieces.filter((p) => p.id !== pieceId);
        const validation = validatePlacement(
          pieceId,
          piece.row,
          piece.col,
          nextRotation,
          this.blockades,
          otherPieces,
          this.gameMode,
        );

        if (validation.valid) {
          piece.rotationIndex = nextRotation;
          this.clearHintFeedback();
          if (this.isWon) this.handleWin();
        } else {
          // Play shake effect
          this.triggerPieceShake(pieceId);
        }
      }
    } else {
      // Rotate in inventory
      const piece = this.inventoryPieces.find((p) => p.id === pieceId);
      if (piece) {
        piece.rotationIndex += 1;
        this.clearHintFeedback();
      }
    }
  }

  triggerPieceShake(pieceId) {
    if (!this.shakingPieces.includes(pieceId)) {
      this.shakingPieces.push(pieceId);
      const timeoutId = setTimeout(() => {
        this.shakingPieces = this.shakingPieces.filter((id) => id !== pieceId);
        this.shakeTimeouts.delete(timeoutId);
      }, 500);
      this.shakeTimeouts.add(timeoutId);
    }
  }

  // DRAG AND DROP ACTIONS
  startDragFromInventory(pieceId, grabbedCell, clientX, clientY) {
    if (this.isWinning) return;
    const piece = this.inventoryPieces.find((p) => p.id === pieceId);
    if (!piece) return;

    this.draggedPiece = {
      id: pieceId,
      rotationIndex: piece.rotationIndex,
      origin: "inventory",
    };
    this.grabbedCell = grabbedCell;
    this.pointerPos = { x: clientX, y: clientY };
    this.dragStartPos = { x: clientX, y: clientY };
    this.draggedOffset = { x: 0, y: 0 };
    this.hoveredCell = null;
  }

  startDragFromBoard(pieceId, grabbedCell, clientX, clientY) {
    if (this.isWinning) return;
    const pieceIdx = this.placedPieces.findIndex((p) => p.id === pieceId);
    if (pieceIdx === -1) return;

    const piece = this.placedPieces[pieceIdx];

    this.draggedPiece = {
      id: pieceId,
      rotationIndex: piece.rotationIndex,
      origin: "board",
      originalRow: piece.row,
      originalCol: piece.col,
      originalRotationIndex: piece.rotationIndex,
    };

    // Remove it from placed list while dragging
    this.placedPieces = this.placedPieces.filter((p) => p.id !== pieceId);

    this.grabbedCell = grabbedCell;
    this.pointerPos = { x: clientX, y: clientY };
    this.dragStartPos = { x: clientX, y: clientY };
    this.draggedOffset = { x: 0, y: 0 };
    this.hoveredCell = null;
  }

  updateDrag(clientX, clientY, gridRect) {
    if (!this.draggedPiece) return;

    this.pointerPos = { x: clientX, y: clientY };
    this.draggedOffset = {
      x: clientX - this.dragStartPos.x,
      y: clientY - this.dragStartPos.y,
    };

    const hoveredGridCell = clientPointToGridCell(
      gridRect,
      clientX,
      clientY,
      this.gridHeight,
      this.gridWidth,
    );

    if (hoveredGridCell) {
      const targetRow = hoveredGridCell.r - this.grabbedCell.r;
      const targetCol = hoveredGridCell.c - this.grabbedCell.c;

      // Keep track of hover cell coordinates
      this.hoveredCell = { r: targetRow, c: targetCol };
    } else {
      this.hoveredCell = null;
    }
  }

  // Drops are resolved from snapped grid cells, not visual pixel edges. A
  // single placed piece under the target is swapped out; touching two or more
  // pieces is ambiguous and leaves the board unchanged.
  getDropResolution(pieceId, row, col, rotationIndex) {
    const baseValidation = validatePlacement(
      pieceId,
      row,
      col,
      rotationIndex,
      this.blockades,
      [],
      this.gameMode,
    );
    if (!baseValidation.valid) return { ...baseValidation, displacedPieces: [] };

    const targetCells = new Set(baseValidation.cells.map(([r, c]) => `${r},${c}`));
    const displacedPieces = this.placedPieces.filter((piece) => {
      const shape =
        PIECE_ORIENTATIONS[piece.id][piece.rotationIndex % PIECE_ORIENTATIONS[piece.id].length];
      return shape.some(([dr, dc]) => targetCells.has(`${piece.row + dr},${piece.col + dc}`));
    });

    if (displacedPieces.length > 1) {
      return { valid: false, reason: "Overlaps with multiple pieces", displacedPieces: [] };
    }

    const displacedIds = new Set(displacedPieces.map((piece) => piece.id));

    const validation = validatePlacement(
      pieceId,
      row,
      col,
      rotationIndex,
      this.blockades,
      this.placedPieces.filter((piece) => !displacedIds.has(piece.id)),
      this.gameMode,
    );

    return { ...validation, displacedPieces: validation.valid ? displacedPieces : [] };
  }

  endDrag({ droppedOnBoard = false } = {}) {
    if (!this.draggedPiece) return;

    const { id, rotationIndex, origin, originalRow, originalCol } = this.draggedPiece;
    let placedSuccessfully = false;

    if (droppedOnBoard && this.hoveredCell) {
      const targetRow = this.hoveredCell.r;
      const targetCol = this.hoveredCell.c;

      const resolution = this.getDropResolution(id, targetRow, targetCol, rotationIndex);

      if (resolution.valid) {
        const displacedIds = new Set(resolution.displacedPieces.map((piece) => piece.id));
        this.placedPieces = this.placedPieces.filter((piece) => !displacedIds.has(piece.id));
        for (const piece of resolution.displacedPieces) {
          this.inventoryPieces.push({ id: piece.id, rotationIndex: piece.rotationIndex });
        }

        // Place piece
        this.placedPieces.push({
          id,
          row: targetRow,
          col: targetCol,
          rotationIndex,
        });

        // If it came from inventory, remove it from inventory
        if (origin === "inventory") {
          this.inventoryPieces = this.inventoryPieces.filter((p) => p.id !== id);
        }

        placedSuccessfully = true;
        this.clearHintFeedback();

        // Check win
        if (this.isWon) {
          this.handleWin();
        }
      }
    }

    if (!placedSuccessfully) {
      // Revert piece to its origin
      if (origin === "board") {
        if (!droppedOnBoard) {
          const existingPiece = this.inventoryPieces.find((p) => p.id === id);
          if (!existingPiece) {
            this.inventoryPieces.push({
              id,
              rotationIndex,
            });
          } else {
            existingPiece.rotationIndex = rotationIndex;
          }
        } else {
          // Invalid board drops return the piece to its original board position.
          this.placedPieces.push({
            id,
            row: originalRow,
            col: originalCol,
            rotationIndex: this.draggedPiece.originalRotationIndex,
          });
        }
      } else {
        // Remains in inventory
        const invPiece = this.inventoryPieces.find((p) => p.id === id);
        if (invPiece) {
          invPiece.rotationIndex = rotationIndex;
        }
      }
    }

    // Reset drag state
    this.draggedPiece = null;
    this.hoveredCell = null;
  }

  // Recall a placed piece back to inventory
  recallPiece(pieceId) {
    const pieceIdx = this.placedPieces.findIndex((p) => p.id === pieceId);
    if (pieceIdx === -1) return;

    const piece = this.placedPieces[pieceIdx];
    this.placedPieces = this.placedPieces.filter((p) => p.id !== pieceId);
    this.clearHintFeedback();

    const existingPiece = this.inventoryPieces.find((p) => p.id === pieceId);
    if (!existingPiece) {
      this.inventoryPieces.push({
        id: pieceId,
        rotationIndex: piece.rotationIndex,
      });
    } else {
      existingPiece.rotationIndex = piece.rotationIndex;
    }
  }

  // Clear all placed pieces back to inventory
  recallAllPieces() {
    this.placedPieces.forEach((p) => {
      this.inventoryPieces.push({
        id: p.id,
        rotationIndex: p.rotationIndex,
      });
    });
    this.placedPieces = [];
    this.clearHintFeedback();
  }
}

// Export a singleton instance
export const gameStore = new GameStore();
export default gameStore;

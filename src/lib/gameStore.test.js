import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSolution,
  GRID_HEIGHT,
  GRID_WIDTH,
  PIECE_ORIENTATIONS,
  validatePlacement,
} from "./game.js";
import { GameStore } from "./gameStore.svelte.js";

const gridRect = {
  left: 100,
  top: 50,
  right: 350,
  bottom: 350,
  width: 250,
  height: 300,
};

function pointForCell(row, col) {
  return {
    x: gridRect.left + col * 50 + 25,
    y: gridRect.top + row * 50 + 25,
  };
}

describe("GameStore drag transitions", () => {
  let store;

  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    store = new GameStore();
    store.currentLevelIndex = 0;
    store.initLevel({ randomizeLevel: false });
  });

  it("numbers the easiest catalogue level first while retaining stable level IDs", () => {
    expect(store.levelId).toBe(169);
    expect(store.puzzleNumber).toBe(34);

    store.currentLevelIndex = store.levelsList.length - 1;
    expect(store.levelId).toBe(202);
    expect(store.puzzleNumber).toBe(1);
  });

  it("places an inventory piece using the grabbed block as its anchor", () => {
    const placement = findSolution(store.blockades)[0];
    const grabbedCell = PIECE_ORIENTATIONS[placement.id][placement.rotationIndex][0];
    const inventoryPiece = store.inventoryPieces.find((piece) => piece.id === placement.id);
    inventoryPiece.rotationIndex = placement.rotationIndex;
    const pointer = pointForCell(placement.row + grabbedCell[0], placement.col + grabbedCell[1]);

    store.startDragFromInventory(placement.id, { r: grabbedCell[0], c: grabbedCell[1] }, 0, 0);
    store.updateDrag(pointer.x, pointer.y, gridRect);
    store.endDrag({ droppedOnBoard: true });

    expect(store.placedPieces).toContainEqual(placement);
    expect(store.inventoryPieces.some((piece) => piece.id === placement.id)).toBe(false);
  });

  it("restores a board piece after an invalid board drop", () => {
    const placement = findSolution(store.blockades)[0];
    store.placedPieces = [{ ...placement }];
    store.inventoryPieces = store.inventoryPieces.filter((piece) => piece.id !== placement.id);

    store.startDragFromBoard(placement.id, { r: 0, c: 0 }, 0, 0);
    store.hoveredCell = { r: -1, c: -1 };
    store.endDrag({ droppedOnBoard: true });

    expect(store.placedPieces).toEqual([placement]);
    expect(store.inventoryPieces.some((piece) => piece.id === placement.id)).toBe(false);
  });

  it("returns a board piece to inventory when dropped outside", () => {
    const placement = findSolution(store.blockades)[0];
    store.placedPieces = [{ ...placement }];
    store.inventoryPieces = store.inventoryPieces.filter((piece) => piece.id !== placement.id);

    store.startDragFromBoard(placement.id, { r: 0, c: 0 }, 0, 0);
    store.updateDrag(20, 20, gridRect);
    store.endDrag({ droppedOnBoard: false });

    expect(store.placedPieces).toEqual([]);
    expect(store.inventoryPieces).toContainEqual({
      id: placement.id,
      rotationIndex: placement.rotationIndex,
    });
  });

  it("places one useful piece for each hint", () => {
    expect(store.requestHint()).toBe(true);
    expect(store.placedPieces).toHaveLength(1);
    expect(store.inventoryPieces).toHaveLength(6);
    expect(store.hintsUsed).toBe(1);
    expect(store.hintedPieceId).toBe(store.placedPieces[0].id);
    expect(store.hintMessage).toContain(`Placed the ${store.hintedPieceId}-piece`);
    expect(store.getCompatibleSolution()).not.toBeNull();

    expect(store.requestHint()).toBe(true);
    expect(store.placedPieces).toHaveLength(2);
    expect(store.inventoryPieces).toHaveLength(5);
    expect(store.hintsUsed).toBe(2);
  });

  it("places a hint compatible with correct existing placements", () => {
    const solution = findSolution(store.blockades);
    store.placedPieces = [{ ...solution[0] }];
    store.inventoryPieces = store.inventoryPieces.filter((piece) => piece.id !== solution[0].id);

    expect(store.requestHint()).toBe(true);
    const compatible = store.getCompatibleSolution();

    expect(compatible).toContainEqual(solution[0]);
    expect(store.placedPieces).toHaveLength(2);
    expect(store.placedPieces[1].id).not.toBe(solution[0].id);
  });

  it("identifies a piece to move when the layout cannot be completed", () => {
    const solutions = store.getSolutions();
    const solutionPlacements = solutions.flat();
    let incompatiblePlacement = null;
    for (const [id, rotations] of Object.entries(PIECE_ORIENTATIONS)) {
      for (const [rotationIndex] of rotations.entries()) {
        for (let row = 0; row < GRID_HEIGHT && !incompatiblePlacement; row++) {
          for (let col = 0; col < GRID_WIDTH; col++) {
            const candidate = { id, row, col, rotationIndex };
            const valid = validatePlacement(id, row, col, rotationIndex, store.blockades, []).valid;
            const appearsInSolution = solutionPlacements.some(
              (placement) =>
                placement.id === id &&
                placement.row === row &&
                placement.col === col &&
                placement.rotationIndex === rotationIndex,
            );
            if (valid && !appearsInSolution) {
              incompatiblePlacement = candidate;
              break;
            }
          }
        }
      }
    }
    expect(incompatiblePlacement).not.toBeNull();
    store.placedPieces = [{ ...incompatiblePlacement }];
    store.inventoryPieces = store.inventoryPieces.filter(
      (piece) => piece.id !== incompatiblePlacement.id,
    );
    expect(store.getCompatibleSolution()).toBeNull();

    expect(store.requestHint()).toBe(true);

    expect(store.placedPieces).toEqual([incompatiblePlacement]);
    expect(store.hintsUsed).toBe(1);
    expect(store.conflictingPieceId).toBe(incompatiblePlacement.id);
    expect(store.hintMessage).toBe(
      `This layout can’t be completed. Try moving the ${incompatiblePlacement.id}-piece.`,
    );
  });

  it("persists player completions and best hint counts", () => {
    const values = new Map();
    const storage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    };
    store.connectStorage(storage);
    store.hintsUsed = 2;
    store.placedPieces = findSolution(store.blockades);

    store.handleWin();

    expect(store.completionStatus).toBe("Completed");
    expect(store.progress.completed[store.levelId].bestHints).toBe(2);
    expect(storage.setItem).toHaveBeenCalled();

    const restoredStore = new GameStore();
    restoredStore.connectStorage(storage);
    expect(restoredStore.progress.completed[store.levelId].bestHints).toBe(2);
  });

  it("clears hint feedback but retains the usage count after a move", () => {
    store.requestHint();
    const placement = store
      .getCompatibleSolution()
      .find((candidate) => !store.placedPieces.some((piece) => piece.id === candidate.id));
    const inventoryPiece = store.inventoryPieces.find((piece) => piece.id === placement.id);
    inventoryPiece.rotationIndex = placement.rotationIndex;
    store.startDragFromInventory(placement.id, { r: 0, c: 0 }, 0, 0);
    store.hoveredCell = { r: placement.row, c: placement.col };

    store.endDrag({ droppedOnBoard: true });

    expect(store.hintMessage).toBe("");
    expect(store.hintedPieceId).toBeNull();
    expect(store.conflictingPieceId).toBeNull();
    expect(store.hintsUsed).toBe(1);
  });
});

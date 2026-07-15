import levels from "../../levels.json";

export const GRID_WIDTH = 5;
export const GRID_HEIGHT = 6;
export const GRID_SIZE = GRID_WIDTH * GRID_HEIGHT;

export const TETROMINOES = {
  I: [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  O: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  T: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ],
  L: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  J: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ],
  S: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ],
  Z: [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ],
};

export const PIECE_THEMES = {
  I: {
    bg: "bg-info border-info/40 text-info-content",
    color: "oklch(var(--in))",
    name: "I-Piece",
  },
  O: {
    bg: "bg-warning border-warning/40 text-warning-content",
    color: "oklch(var(--wa))",
    name: "O-Piece",
  },
  T: {
    bg: "bg-secondary border-secondary/40 text-secondary-content",
    color: "oklch(var(--s))",
    name: "T-Piece",
  },
  L: {
    bg: "bg-accent border-accent/40 text-accent-content",
    color: "oklch(var(--a))",
    name: "L-Piece",
  },
  J: {
    bg: "bg-primary border-primary/40 text-primary-content",
    color: "oklch(var(--p))",
    name: "J-Piece",
  },
  S: {
    bg: "bg-success border-success/40 text-success-content",
    color: "oklch(var(--su))",
    name: "S-Piece",
  },
  Z: {
    bg: "bg-error border-error/40 text-error-content",
    color: "oklch(var(--er))",
    name: "Z-Piece",
  },
};

// Calculate all unique rotations for each piece
export function getRotations(coords) {
  const rotations = [];
  let current = coords;
  for (let i = 0; i < 4; i++) {
    // Rotate 90 deg clockwise: (r, c) -> (c, -r)
    const rotated = current.map(([r, c]) => [c, -r]);
    const minR = Math.min(...rotated.map(([r, _c]) => r));
    const minC = Math.min(...rotated.map(([_r, c]) => c));
    const normalized = rotated
      .map(([r, c]) => [r - minR, c - minC])
      .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

    const isDuplicate = rotations.some(
      (existing) =>
        existing.length === normalized.length &&
        existing.every(
          (val, idx) => val[0] === normalized[idx][0] && val[1] === normalized[idx][1],
        ),
    );
    if (!isDuplicate) rotations.push(normalized);
    current = normalized;
  }
  return rotations;
}

export const PIECE_ORIENTATIONS = Object.entries(TETROMINOES).reduce((acc, [name, coords]) => {
  acc[name] = getRotations(coords);
  return acc;
}, {});

export const DIFFICULTIES = ["easy", "normal", "hard"];

/**
 * Get all levels in a named difficulty tier.
 * Easy puzzles have more than 13 solutions, normal puzzles have 4–12,
 * and hard puzzles have 1–3.
 */
export function getLevelsByDifficulty(difficulty) {
  switch (difficulty) {
    case "easy":
      return levels.filter((lvl) => lvl.solutionCount > 13);
    case "normal":
      return levels.filter((lvl) => lvl.solutionCount >= 4 && lvl.solutionCount <= 12);
    case "hard":
      return levels.filter((lvl) => lvl.solutionCount >= 1 && lvl.solutionCount <= 3);
    default:
      return [];
  }
}

/**
 * Find every complete tiling for a board with the supplied blockade pegs.
 * Each solution contains placements compatible with Piece.svelte.
 */
export function findSolutions(blockades) {
  const occupied = new Set(blockades.map(([r, c]) => `${r},${c}`));
  const pieceIds = Object.keys(PIECE_ORIENTATIONS);
  const solutions = [];

  function canPlace(shape, row, col) {
    return shape.every(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      return r >= 0 && r < GRID_HEIGHT && c >= 0 && c < GRID_WIDTH && !occupied.has(`${r},${c}`);
    });
  }

  function setPlacement(shape, row, col, add) {
    for (const [dr, dc] of shape) {
      const cell = `${row + dr},${col + dc}`;
      if (add) occupied.add(cell);
      else occupied.delete(cell);
    }
  }

  function findFirstEmptyCell() {
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        if (!occupied.has(`${row},${col}`)) return [row, col];
      }
    }
    return null;
  }

  function search(remainingPieceIds, placements) {
    if (remainingPieceIds.length === 0) {
      solutions.push(placements);
      return;
    }

    const emptyCell = findFirstEmptyCell();
    if (!emptyCell) return;
    const [emptyRow, emptyCol] = emptyCell;

    for (const pieceId of remainingPieceIds) {
      const remaining = remainingPieceIds.filter((id) => id !== pieceId);
      for (const [rotationIndex, shape] of PIECE_ORIENTATIONS[pieceId].entries()) {
        for (const [anchorRow, anchorCol] of shape) {
          const row = emptyRow - anchorRow;
          const col = emptyCol - anchorCol;
          if (!canPlace(shape, row, col)) continue;

          setPlacement(shape, row, col, true);
          search(remaining, [...placements, { id: pieceId, row, col, rotationIndex }]);
          setPlacement(shape, row, col, false);
        }
      }
    }
  }

  search(pieceIds, []);
  return solutions;
}

/**
 * Find one complete tiling for a board with the supplied blockade pegs.
 * Returns placements compatible with Piece.svelte, or null when unsolvable.
 */
export function findSolution(blockades) {
  return findSolutions(blockades)[0] || null;
}

/**
 * Checks if a given blockade coord is present in blockades list
 */
export function isBlockade(r, c, blockades) {
  return blockades.some(([br, bc]) => br === r && bc === c);
}

/**
 * Validates whether a piece can be placed at the given row, col on the board
 * without overlapping blockades, going out of bounds, or overlapping other placed pieces
 */
export function validatePlacement(pieceId, row, col, rotationIndex, blockades, placedPieces) {
  const rotations = PIECE_ORIENTATIONS[pieceId];
  if (!rotations) return { valid: false, reason: "Invalid piece ID" };

  const shape = rotations[rotationIndex % rotations.length];
  const occupiedCells = [];

  for (const [dr, dc] of shape) {
    const r = row + dr;
    const c = col + dc;

    // Bounds check
    if (r < 0 || r >= GRID_HEIGHT || c < 0 || c >= GRID_WIDTH) {
      return { valid: false, reason: "Out of bounds" };
    }

    // Blockade check
    if (isBlockade(r, c, blockades)) {
      return { valid: false, reason: "Collides with blockade" };
    }

    occupiedCells.push([r, c]);
  }

  // Check overlap with other placed pieces
  for (const other of placedPieces) {
    if (other.id === pieceId) continue; // Skip self check
    const otherRotations = PIECE_ORIENTATIONS[other.id];
    const otherShape = otherRotations[other.rotationIndex % otherRotations.length];

    for (const [odr, odc] of otherShape) {
      const or = other.row + odr;
      const oc = other.col + odc;

      for (const [r, c] of occupiedCells) {
        if (or === r && oc === c) {
          return { valid: false, reason: "Overlaps with another piece" };
        }
      }
    }
  }

  return { valid: true, cells: occupiedCells };
}

/**
 * Verify if the complete board has been solved.
 * Since the grid is 6x5 (30 cells), blockades cover 2 cells, and 7 tetrominoes cover 28 cells.
 * If 7 pieces are placed and all placements are valid, the board is solved.
 */
export function checkWinCondition(placedPieces, blockades) {
  if (placedPieces.length !== 7) return false;

  // Verify each piece placement is valid relative to others and blockades
  for (let i = 0; i < placedPieces.length; i++) {
    const piece = placedPieces[i];
    const otherPieces = placedPieces.filter((_, idx) => idx !== i);
    const result = validatePlacement(
      piece.id,
      piece.row,
      piece.col,
      piece.rotationIndex,
      blockades,
      otherPieces,
    );
    if (!result.valid) return false;
  }

  return true;
}

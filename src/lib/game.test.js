import { describe, expect, it } from "vitest";
import {
  checkWinCondition,
  findSolution,
  findSolutions,
  getLevels,
  isBlockade,
  PIECE_ORIENTATIONS,
  validatePlacement,
} from "./game.js";

describe("Game Tiling Logic", () => {
  it("pre-computes correct number of rotations", () => {
    // I should have 2 unique rotations
    expect(PIECE_ORIENTATIONS.I.length).toBe(2);
    // O should have 1 unique rotation
    expect(PIECE_ORIENTATIONS.O.length).toBe(1);
    // L should have 4 unique rotations
    expect(PIECE_ORIENTATIONS.L.length).toBe(4);
  });

  it("correctly checks blockades", () => {
    const blockades = [
      [0, 1],
      [3, 4],
    ];
    expect(isBlockade(0, 1, blockades)).toBe(true);
    expect(isBlockade(1, 0, blockades)).toBe(false);
  });

  it("validates bounds, blockades, and overlaps", () => {
    const blockades = [
      [0, 1],
      [5, 4],
    ];

    // 1. Valid placement: I piece at (1, 0) horizontal
    // Shape at rotation 0 is [[0, 0], [0, 1], [0, 2], [0, 3]]
    // Occupied: (1,0), (1,1), (1,2), (1,3)
    let res = validatePlacement("I", 1, 0, 0, blockades, []);
    expect(res.valid).toBe(true);

    // 2. Out of bounds check: I piece at (0, 3) horizontal extends to col 6 (rotation 1 is horizontal)
    res = validatePlacement("I", 0, 3, 1, blockades, []);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("Out of bounds");

    // 3. Blockade check: I piece at (0, 0) horizontal covers (0,1) which is a blockade
    res = validatePlacement("I", 0, 0, 1, blockades, []);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("Collides with blockade");

    // 4. Overlap check: Place another piece overlapping with first
    const placed = [{ id: "I", row: 1, col: 0, rotationIndex: 1 }];
    // O piece at (1, 1) occupies (1,1), (1,2), (2,1), (2,2) -> overlaps on (1,1) and (1,2)
    res = validatePlacement("O", 1, 1, 0, blockades, placed);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("Overlaps with another piece");
  });

  it("determines win condition correctly", () => {
    const blockades = [
      [0, 1],
      [1, 2],
    ];

    // Unfinished placements
    expect(checkWinCondition([], blockades)).toBe(false);
  });

  it("makes the complete 5x6 puzzle catalogue available", () => {
    const levels = getLevels();

    expect(levels).not.toHaveLength(0);
    expect(levels.every((level) => level.solutionCount >= 1)).toBe(true);
  });

  it("finds a complete valid tiling for a puzzle", () => {
    const blockades = [
      [0, 1],
      [1, 2],
    ];
    const solution = findSolution(blockades);

    expect(solution).not.toBeNull();
    expect(solution).toHaveLength(7);
    expect(checkWinCondition(solution, blockades)).toBe(true);
  });

  it("finds every valid tiling for a puzzle", () => {
    const blockades = [
      [0, 1],
      [4, 1],
    ];
    const solutions = findSolutions(blockades);

    expect(solutions.length).toBeGreaterThan(1);
    expect(solutions.every((solution) => checkWinCondition(solution, blockades))).toBe(true);
  });

  it("finds solution and validates win condition for no-t (Notsosquare++) mode", () => {
    const noTLevels = getLevels("no-t");
    expect(noTLevels).toHaveLength(1);
    const blockades = noTLevels[0].blockades;
    expect(blockades).toEqual([]);

    const solutions = findSolutions(blockades, "no-t");
    expect(solutions).toHaveLength(2);
    const solution = findSolution(blockades, "no-t");
    expect(solution).toHaveLength(6);
    expect(solution.some((p) => p.id === "T")).toBe(false);
    expect(checkWinCondition(solution, blockades, "no-t")).toBe(true);
  });
});


import { describe, expect, it } from "vitest";
import {
  checkWinCondition,
  DIFFICULTIES,
  findSolution,
  findSolutions,
  getLevelsByDifficulty,
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

  it("groups puzzles into easy, normal, and hard difficulty tiers", () => {
    expect(DIFFICULTIES).toEqual(["easy", "normal", "hard"]);

    const easyLevels = getLevelsByDifficulty("easy");
    expect(easyLevels).not.toHaveLength(0);
    expect(easyLevels.every((level) => level.solutionCount > 13)).toBe(true);

    const normalLevels = getLevelsByDifficulty("normal");
    expect(normalLevels).not.toHaveLength(0);
    expect(
      normalLevels.every((level) => level.solutionCount >= 4 && level.solutionCount <= 12),
    ).toBe(true);

    const hardLevels = getLevelsByDifficulty("hard");
    expect(hardLevels).not.toHaveLength(0);
    expect(hardLevels.every((level) => level.solutionCount >= 1 && level.solutionCount <= 3)).toBe(
      true,
    );

    expect(getLevelsByDifficulty("unknown")).toEqual([]);
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
});

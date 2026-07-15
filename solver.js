/**
 * Tetromino Layout Generator (5x6 Grid) - v2
 *
 * v1 bug: it filled the board greedily (always covering the topmost-leftmost
 * empty cell) and just looked at whatever 2 cells were left over at the end.
 * That's mathematically guaranteed to push leftover cells toward the END of
 * the scan order (bottom rows) - it never actually tests whether OTHER peg
 * positions are solvable, because it never tries them.
 *
 * Fix: enumerate every possible pair of peg positions across the whole grid,
 * pre-block those two cells as obstacles, and run an exact-cover search to
 * see if the remaining 28 cells can be exactly tiled by the 7 tetrominoes.
 */

const GRID_WIDTH = 5;
const GRID_HEIGHT = 6;
const GRID_SIZE = GRID_WIDTH * GRID_HEIGHT;

const TETROMINOES = {
  I: [[0, 0], [0, 1], [0, 2], [0, 3]],
  O: [[0, 0], [0, 1], [1, 0], [1, 1]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  J: [[0, 0], [0, 1], [0, 2], [1, 0]],
  S: [[0, 1], [0, 2], [1, 0], [1, 1]],
  Z: [[0, 0], [0, 1], [1, 1], [1, 2]]
};

function getRotations(coords) {
  const rotations = [];
  let current = coords;
  for (let i = 0; i < 4; i++) {
    let rotated = current.map(([r, c]) => [c, -r]);
    let minR = Math.min(...rotated.map(([r, c]) => r));
    let minC = Math.min(...rotated.map(([r, c]) => c));
    let normalized = rotated
      .map(([r, c]) => [r - minR, c - minC])
      .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
    let isDuplicate = rotations.some(
      existing =>
        existing.length === normalized.length &&
        existing.every((val, index) => val[0] === normalized[index][0] && val[1] === normalized[index][1])
    );
    if (!isDuplicate) rotations.push(normalized);
    current = normalized;
  }
  return rotations;
}

const PIECE_ORIENTATIONS = Object.entries(TETROMINOES).map(([name, coords]) => ({
  name,
  orientations: getRotations(coords)
}));
const NUM_PIECES = PIECE_ORIENTATIONS.length; // 7

// Given a grid with 2 cells pre-marked as pegs ('PEG'), find ALL exact
// tilings of the remaining cells by the 7 pieces (each used once).
function solveForPegs(grid) {
  let solutionCount = 0;

  function canPlace(shape, targetR, targetC) {
    for (let [dr, dc] of shape) {
      let r = targetR + dr;
      let c = targetC + dc;
      if (r < 0 || r >= GRID_HEIGHT || c < 0 || c >= GRID_WIDTH || grid[r][c] !== null) {
        return false;
      }
    }
    return true;
  }
  function place(shape, targetR, targetC, val) {
    for (let [dr, dc] of shape) grid[targetR + dr][targetC + dc] = val;
  }

  function backtrack(usedMask, piecesPlaced) {
    if (piecesPlaced === NUM_PIECES) {
      solutionCount++;
      return;
    }

    let emptyR = -1,
      emptyC = -1;
    for (let r = 0; r < GRID_HEIGHT && emptyR === -1; r++) {
      for (let c = 0; c < GRID_WIDTH; c++) {
        if (grid[r][c] === null) {
          emptyR = r;
          emptyC = c;
          break;
        }
      }
    }
    if (emptyR === -1) return; // shouldn't happen given piecesPlaced < 7

    for (let pIndex = 0; pIndex < NUM_PIECES; pIndex++) {
      if (usedMask & (1 << pIndex)) continue;
      const piece = PIECE_ORIENTATIONS[pIndex];
      for (let shape of piece.orientations) {
        const targetR = emptyR - shape[0][0];
        const targetC = emptyC - shape[0][1];
        if (canPlace(shape, targetR, targetC)) {
          place(shape, targetR, targetC, piece.name);
          backtrack(usedMask | (1 << pIndex), piecesPlaced + 1);
          place(shape, targetR, targetC, null);
        }
      }
    }
  }

  backtrack(0, 0);
  return solutionCount;
}

function findAllPegPositions() {
  const cells = [];
  for (let r = 0; r < GRID_HEIGHT; r++)
    for (let c = 0; c < GRID_WIDTH; c++) cells.push([r, c]);

  const validLevels = [];
  const heat = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(0));

  let pairsTested = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      pairsTested++;
      const [r1, c1] = cells[i];
      const [r2, c2] = cells[j];

      const grid = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(null));
      grid[r1][c1] = 'PEG';
      grid[r2][c2] = 'PEG';

      const count = solveForPegs(grid);
      if (count > 0) {
        validLevels.push({
          blockades: [[r1, c1], [r2, c2]],
          solutionCount: count
        });
        heat[r1][c1]++;
        heat[r2][c2]++;
      }
    }
  }

  console.log(`Tested ${pairsTested} candidate peg pairs.`);
  console.log(`Solvable peg pairs found: ${validLevels.length}`);
  console.log(`\nHeatmap (how many valid layouts use each cell as a peg):`);
  for (let r = 0; r < GRID_HEIGHT; r++) {
    console.log(heat[r].map(v => String(v).padStart(3)).join(' '));
  }

  const svelteData = validLevels
    .sort((a, b) => a.solutionCount - b.solutionCount)
    .map((lvl, index) => ({ id: index + 1, blockades: lvl.blockades, solutionCount: lvl.solutionCount }));

  require('fs').writeFileSync('levels2.json', JSON.stringify(svelteData, null, 2));
  return svelteData;
}

findAllPegPositions();

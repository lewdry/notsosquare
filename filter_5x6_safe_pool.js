/**
 * Builds a "safe" random pool for the 5x6 / 2-peg mode by trimming the
 * long difficulty tail out of the full 202-level set.
 *
 * Why: for a mode with no difficulty picker (pure random puzzle), the raw
 * pool is dangerously skewed - median nodesPerSolution is ~101, but the
 * worst levels go up to 1502 (nearly 15x the median). A new player could
 * randomly land on one of those on their very first puzzle.
 *
 * Cutoff chosen: 2x the median nodesPerSolution (~203). This removes the
 * genuine outliers (the ~20 levels that require 4-15x more dead-end
 * exploration than a typical level) while keeping the large majority of
 * the pool (158 of 202 levels, ~78%) intact, including levels across the
 * full range of "normal" difficulty.
 */

const fs = require('fs');

const ALL_LEVELS = JSON.parse(fs.readFileSync('levels_5x6_difficulty.json', 'utf8'));

const npsValues = ALL_LEVELS.map(l => l.nodesPerSolution).sort((a, b) => a - b);
const median = npsValues[Math.floor(0.5 * npsValues.length)];
const CUTOFF_MULTIPLIER = 2;
const cutoff = median * CUTOFF_MULTIPLIER;

const safePool = ALL_LEVELS.filter(l => l.nodesPerSolution <= cutoff)
  .sort((a, b) => a.nodesPerSolution - b.nodesPerSolution)
  .map((l, index) => ({
    id: index + 1,
    blockades: l.blockades,
    solutionCount: l.solutionCount,
    nodesExplored: l.nodesExplored,
    nodesPerSolution: l.nodesPerSolution
  }));

const excluded = ALL_LEVELS.filter(l => l.nodesPerSolution > cutoff);

console.log(`Full pool: ${ALL_LEVELS.length} levels`);
console.log(`Median nodesPerSolution: ${median}`);
console.log(`Cutoff (${CUTOFF_MULTIPLIER}x median): ${cutoff}`);
console.log(`Safe pool: ${safePool.length} levels (${(safePool.length / ALL_LEVELS.length * 100).toFixed(0)}%)`);
console.log(`Excluded: ${excluded.length} levels (${(excluded.length / ALL_LEVELS.length * 100).toFixed(0)}%)`);
console.log(`\nSafe pool range: ${safePool[0].nodesPerSolution} to ${safePool[safePool.length - 1].nodesPerSolution} nodesPerSolution`);
console.log(`Excluded range: ${Math.min(...excluded.map(l => l.nodesPerSolution))} to ${Math.max(...excluded.map(l => l.nodesPerSolution))} nodesPerSolution`);

fs.writeFileSync('levels_5x6_safe_pool.json', JSON.stringify(safePool, null, 2));
fs.writeFileSync('levels_5x6_excluded.json', JSON.stringify(excluded, null, 2));

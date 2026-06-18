export const BOARD_SIZE = 8;
export const CHEST_MAX = 8;
export const COMBO_MISS_LIMIT = 3;

export const BONUS_STAGE = {
  scoreMultiplier: 3,
  triggerCombo: 3,
  lineMilestone: 12,
  maxMoves: 5,
  maxMisses: 2,
  colorIndex: 1,
};

export const STORAGE_KEYS = {
  profile: "block-rush-profile-v1",
  run: "block-rush-run-v1",
};

export const SKINS = [
  {
    id: "classic",
    name: "Classic",
    price: 0,
    swatches: ["#2dd4bf", "#facc15", "#fb7185", "#60a5fa"],
    board: "#e7fffb",
  },
  {
    id: "neon",
    name: "Neon",
    price: 220,
    swatches: ["#00f5ff", "#fc28a8", "#baff29", "#8b5cf6"],
    board: "#10181f",
  },
  {
    id: "candy",
    name: "Candy",
    price: 280,
    swatches: ["#ff8ab3", "#7dd3fc", "#f9a8d4", "#fde047"],
    board: "#fff1f7",
  },
  {
    id: "galaxy",
    name: "Galaxy",
    price: 360,
    swatches: ["#38bdf8", "#a78bfa", "#f472b6", "#22c55e"],
    board: "#15172b",
  },
  {
    id: "gold",
    name: "Gold",
    price: 500,
    swatches: ["#f6c453", "#ff8a3d", "#fff0a3", "#d9a118"],
    board: "#2a2010",
  },
];

export const POWERUPS = {
  hammer: { id: "hammer", name: "Hammer", cost: 90 },
  shuffle: { id: "shuffle", name: "Shuffle", cost: 120 },
  bomb: { id: "bomb", name: "Bomb", cost: 150 },
};

export const MISSION_DEFS = [
  { id: "clear20", title: "Clear 20 lines", target: 20, reward: 80 },
  { id: "score1000", title: "Reach 1000 score", target: 1000, reward: 100 },
  { id: "combo3", title: "Make 3 combos", target: 3, reward: 120 },
];

export const PIECE_SHAPES = [
  { id: "single", name: "Dot", cells: [[0, 0]], weight: 3 },
  { id: "duo-h", name: "Bar 2", cells: [[0, 0], [0, 1]], weight: 5 },
  { id: "duo-v", name: "Stack 2", cells: [[0, 0], [1, 0]], weight: 5 },
  { id: "tri-h", name: "Bar 3", cells: [[0, 0], [0, 1], [0, 2]], weight: 5 },
  { id: "tri-v", name: "Stack 3", cells: [[0, 0], [1, 0], [2, 0]], weight: 5 },
  { id: "line4-h", name: "Bar 4", cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 3 },
  { id: "line4-v", name: "Stack 4", cells: [[0, 0], [1, 0], [2, 0], [3, 0]], weight: 3 },
  { id: "line5-h", name: "Bar 5", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 2 },
  { id: "line5-v", name: "Stack 5", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], weight: 2 },
  { id: "box2", name: "Square", cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 5 },
  {
    id: "box3",
    name: "Big Square",
    cells: [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
    weight: 1,
  },
  { id: "corner-a", name: "Corner", cells: [[0, 0], [1, 0], [1, 1]], weight: 4 },
  { id: "corner-b", name: "Corner", cells: [[0, 1], [1, 0], [1, 1]], weight: 4 },
  { id: "l4-a", name: "Hook", cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 3 },
  { id: "l4-b", name: "Hook", cells: [[0, 1], [1, 1], [2, 0], [2, 1]], weight: 3 },
  { id: "t4", name: "Tetra", cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 3 },
  { id: "zig", name: "Zig", cells: [[0, 0], [0, 1], [1, 1], [1, 2]], weight: 3 },
  { id: "step", name: "Step", cells: [[0, 0], [1, 0], [1, 1], [2, 1]], weight: 3 },
];

const AWKWARD_SHAPES = new Set(["box3", "l4-a", "l4-b", "t4", "zig", "step"]);
const LARGE_SHAPES = new Set(["box3", "line5-h", "line5-v"]);
const LINE_FRIENDLY_SHAPES = new Set([
  "single",
  "duo-h",
  "duo-v",
  "tri-h",
  "tri-v",
  "line4-h",
  "line4-v",
  "line5-h",
  "line5-v",
]);
const DREAM_SET_IDS = [
  ["line4-h", "line4-h", "single"],
  ["line4-v", "line4-v", "single"],
  ["tri-h", "line5-h", "duo-v"],
  ["tri-v", "line5-v", "duo-h"],
  ["tri-h", "tri-h", "duo-h"],
  ["tri-v", "tri-v", "duo-v"],
];

export const GAME_PHASES = {
  warmup: "warmup",
  normal: "normal",
  pressure: "pressure",
  highScore: "highScore",
};

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function getSkin(id) {
  return SKINS.find((skin) => skin.id === id) || SKINS[0];
}

export function getPieceBounds(piece) {
  const rows = piece.cells.map(([row]) => row);
  const cols = piece.cells.map(([, col]) => col);
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);
  const maxRow = Math.max(...rows);
  const maxCol = Math.max(...cols);
  return {
    minRow,
    minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

export function normalizeCells(cells) {
  const rows = cells.map(([row]) => row);
  const cols = cells.map(([, col]) => col);
  const minRow = Math.min(...rows);
  const minCol = Math.min(...cols);
  return cells.map(([row, col]) => [row - minRow, col - minCol]);
}

export function getBoardFullness(board) {
  if (!Array.isArray(board)) return 0;
  const filled = board.reduce(
    (total, row) => total + (Array.isArray(row) ? row.filter(Boolean).length : 0),
    0,
  );
  return filled / (BOARD_SIZE * BOARD_SIZE);
}

export function isBoardEmpty(board) {
  return (
    Array.isArray(board) &&
    board.length === BOARD_SIZE &&
    board.every((row) => Array.isArray(row) && row.length === BOARD_SIZE && row.every((cell) => !cell))
  );
}

function shapeCanFit(board, shape) {
  if (!board) return true;
  const piece = { cells: shape.cells, placed: false };
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (canPlacePiece(board, piece, row, col)) return true;
    }
  }
  return false;
}

function getNearClearHints(board) {
  const hints = { single: 0, duoH: 0, duoV: 0, triH: 0, triV: 0 };
  if (!board) return hints;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const emptyCols = [];
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!board[row][col]) emptyCols.push(col);
    }
    if (emptyCols.length === 1) hints.single += 1;
    if (emptyCols.length === 2 && emptyCols[1] === emptyCols[0] + 1) hints.duoH += 1;
    if (
      emptyCols.length === 3 &&
      emptyCols[1] === emptyCols[0] + 1 &&
      emptyCols[2] === emptyCols[1] + 1
    ) {
      hints.triH += 1;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const emptyRows = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      if (!board[row][col]) emptyRows.push(row);
    }
    if (emptyRows.length === 1) hints.single += 1;
    if (emptyRows.length === 2 && emptyRows[1] === emptyRows[0] + 1) hints.duoV += 1;
    if (
      emptyRows.length === 3 &&
      emptyRows[1] === emptyRows[0] + 1 &&
      emptyRows[2] === emptyRows[1] + 1
    ) {
      hints.triV += 1;
    }
  }

  return hints;
}

export function getGamePhase(context = {}) {
  const moves = Math.max(0, Number(context.moves) || 0);
  const score = Math.max(0, Number(context.score) || 0);
  const lines = Math.max(0, Number(context.totalLines) || 0);

  if (moves < 36) return GAME_PHASES.warmup;
  if (moves < 65 && score < 12000 && lines < 40) return GAME_PHASES.normal;
  if (moves < 95 && score < 22000 && lines < 65) return GAME_PHASES.pressure;
  return GAME_PHASES.highScore;
}

function analyzeShapeOpportunity(board, shape) {
  if (!board || !shape) return { lines: 0, boardClear: false };
  const piece = { cells: shape.cells, placed: false };
  let bestLines = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!canPlacePiece(board, piece, row, col)) continue;
      const placed = placePiece(board, piece, row, col);
      const completed = findCompletedLines(placed);
      bestLines = Math.max(bestLines, completed.count);
      if (completed.count > 0 && isBoardEmpty(clearCompletedLines(placed, completed).board)) {
        return { lines: completed.count, boardClear: true };
      }
    }
  }
  return { lines: bestLines, boardClear: false };
}

export function getShapeClearOpportunity(board, shape) {
  return analyzeShapeOpportunity(board, shape).lines;
}

export function getShapeBoardClearOpportunity(board, shape) {
  return analyzeShapeOpportunity(board, shape).boardClear;
}

export function getAdaptiveShapeWeight(shape, context = {}) {
  const fullness = getBoardFullness(context.board);
  const moves = Math.max(0, Number(context.moves) || 0);
  const phase = context.phase || getGamePhase(context);
  const crowded = fullness >= 0.55;
  const veryCrowded = fullness >= 0.7;
  const struggling = fullness >= 0.62 || (Number(context.comboMisses) || 0) >= 2;
  const cellCount = shape.cells.length;
  const hints = context.hints || getNearClearHints(context.board);
  const clearOpportunity =
    context.clearOpportunities?.[shape.id] ?? getShapeClearOpportunity(context.board, shape);
  const boardClearOpportunity =
    context.boardClearOpportunities?.[shape.id] ??
    getShapeBoardClearOpportunity(context.board, shape);
  let weight = shape.weight;

  if (phase === GAME_PHASES.warmup) {
    if (cellCount <= 3) weight *= 1.75;
    if (cellCount === 4 && !AWKWARD_SHAPES.has(shape.id)) weight *= 1.18;
    if (cellCount >= 5) weight *= 0.28;
    if (AWKWARD_SHAPES.has(shape.id)) weight *= 0.42;
    if (LINE_FRIENDLY_SHAPES.has(shape.id)) weight *= 1.28;
  } else if (phase === GAME_PHASES.pressure) {
    if (cellCount >= 4 && fullness < 0.55) weight *= 1.2;
    if (AWKWARD_SHAPES.has(shape.id) && fullness < 0.5) weight *= 1.12;
  } else if (phase === GAME_PHASES.highScore) {
    if (cellCount >= 4 && fullness < 0.58) weight *= 1.38;
    if (LARGE_SHAPES.has(shape.id) && fullness < 0.5) weight *= 1.28;
    if (cellCount <= 2 && fullness < 0.45) weight *= 0.72;
  }

  if (crowded) {
    if (cellCount <= 2) weight *= veryCrowded ? 2.7 : 1.9;
    if (cellCount === 3) weight *= 1.35;
    if (cellCount >= 5) weight *= veryCrowded ? 0.12 : 0.36;
    if (AWKWARD_SHAPES.has(shape.id)) weight *= veryCrowded ? 0.38 : 0.68;
  }

  if (struggling) {
    if (cellCount <= 3) weight *= 1.35;
    if (AWKWARD_SHAPES.has(shape.id)) weight *= 0.58;
    if (LARGE_SHAPES.has(shape.id)) weight *= 0.42;
  }

  if (clearOpportunity > 0) {
    const assistance = phase === GAME_PHASES.warmup ? 1.8 : struggling ? 1.5 : 1.28;
    weight *= assistance + Math.min(0.55, clearOpportunity * 0.22);
  }
  if (boardClearOpportunity) {
    weight *= phase === GAME_PHASES.warmup ? 2.15 : struggling ? 1.7 : 1.42;
  }

  if (shape.id === "single" && hints.single > 0) weight *= 1 + Math.min(2.2, hints.single * 0.7);
  if (shape.id === "duo-h" && hints.duoH > 0) weight *= 1 + Math.min(1.7, hints.duoH * 0.55);
  if (shape.id === "duo-v" && hints.duoV > 0) weight *= 1 + Math.min(1.7, hints.duoV * 0.55);
  if (shape.id === "tri-h" && hints.triH > 0) weight *= 1 + Math.min(1.45, hints.triH * 0.45);
  if (shape.id === "tri-v" && hints.triV > 0) weight *= 1 + Math.min(1.45, hints.triV * 0.45);
  if (context.selectedShapeIds?.includes(shape.id)) weight *= 0.22;
  if (context.recentAwkward && AWKWARD_SHAPES.has(shape.id)) weight *= 0.42;
  if (context.suppressAwkward && AWKWARD_SHAPES.has(shape.id)) weight *= 0.08;
  if (context.suppressLarge && LARGE_SHAPES.has(shape.id)) weight *= 0.06;

  return Math.max(0.02, weight);
}

function weightedShape(rng = Math.random, context = {}) {
  const hints = getNearClearHints(context.board);
  const phase = getGamePhase(context);
  const fittingShapes = PIECE_SHAPES.filter((shape) => shapeCanFit(context.board, shape));
  const candidates = fittingShapes.length ? fittingShapes : PIECE_SHAPES;
  const opportunities = candidates.map((shape) => [shape.id, analyzeShapeOpportunity(context.board, shape)]);
  const clearOpportunities = Object.fromEntries(
    opportunities.map(([shapeId, opportunity]) => [shapeId, opportunity.lines]),
  );
  const boardClearOpportunities = Object.fromEntries(
    opportunities.map(([shapeId, opportunity]) => [shapeId, opportunity.boardClear]),
  );
  const weighted = candidates.map((shape) => ({
    shape,
    weight: getAdaptiveShapeWeight(shape, {
      ...context,
      phase,
      hints,
      clearOpportunities,
      boardClearOpportunities,
    }),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let pick = rng() * total;
  for (const item of weighted) {
    pick -= item.weight;
    if (pick <= 0) return item.shape;
  }
  return weighted[0].shape;
}

function boardOccupancyKey(board) {
  return board.map((row) => row.map((cell) => (cell ? "1" : "0")).join("")).join("");
}

function getPlacementOutcomes(board, shape, limit = 3, cache) {
  const cacheKey = cache ? `${shape.id}:${boardOccupancyKey(board)}` : "";
  if (cache?.has(cacheKey)) return cache.get(cacheKey);
  const piece = { cells: shape.cells, placed: false };
  const beforeFilled = board.flat().filter(Boolean).length;
  const outcomes = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!canPlacePiece(board, piece, row, col)) continue;
      const placed = placePiece(board, piece, row, col);
      const completed = findCompletedLines(placed);
      const nextBoard = completed.count > 0
        ? clearCompletedLines(placed, completed).board
        : placed;
      const afterFilled = nextBoard.flat().filter(Boolean).length;
      const boardClear = completed.count > 0 && isBoardEmpty(nextBoard);
      const fullnessReduction = Math.max(0, beforeFilled - afterFilled);
      outcomes.push({
        board: nextBoard,
        boardClear,
        score:
          completed.count * 95 +
          Math.max(0, completed.count - 1) * 120 +
          fullnessReduction * 7 +
          (boardClear ? 4200 : 0),
      });
    }
  }

  const result = outcomes.sort((a, b) => b.score - a.score).slice(0, limit);
  cache?.set(cacheKey, result);
  return result;
}

export function evaluateHandFun(board, shapes, context = {}) {
  if (!board || !Array.isArray(shapes) || shapes.length !== 3) {
    return { score: Number.NEGATIVE_INFINITY, boardClear: false };
  }

  const phase = context.phase || getGamePhase(context);
  const pity = Math.max(0, Number(context.boardClearPity) || 0);
  const awkwardCount = shapes.filter((shape) => AWKWARD_SHAPES.has(shape.id)).length;
  const largeCount = shapes.filter((shape) => LARGE_SHAPES.has(shape.id)).length;
  const repeatedCount = shapes.length - new Set(shapes.map((shape) => shape.id)).size;
  let states = [{ board, mask: 0, score: 0, boardClear: false }];

  for (let depth = 0; depth < 3; depth += 1) {
    const nextStates = [];
    for (const state of states) {
      for (let index = 0; index < shapes.length; index += 1) {
        if (state.mask & (1 << index)) continue;
        const outcomes = getPlacementOutcomes(state.board, shapes[index], 3, context.directorCache);
        for (const outcome of outcomes) {
          nextStates.push({
            board: outcome.board,
            mask: state.mask | (1 << index),
            score: state.score + outcome.score,
            boardClear: state.boardClear || outcome.boardClear,
          });
        }
      }
    }
    if (!nextStates.length) break;
    states = nextStates
      .sort((a, b) => (Number(b.boardClear) - Number(a.boardClear)) || b.score - a.score)
      .slice(0, 4);
  }

  const best = states[0] || { score: -900, boardClear: false };
  let score = best.score;
  if (best.boardClear) {
    const phaseValue = phase === GAME_PHASES.warmup ? 5200 : phase === GAME_PHASES.normal ? 3500 : 1900;
    score += phaseValue + Math.min(5000, pity * 260);
  } else {
    score += pity * 24;
  }
  if (phase === GAME_PHASES.warmup) {
    score -= awkwardCount * 520;
    score -= largeCount > 1 ? (largeCount - 1) * 380 : 0;
  } else {
    score -= awkwardCount >= 3 ? 650 : 0;
    score -= largeCount >= 3 ? 480 : 0;
  }
  score -= repeatedCount * 150;

  return { score, boardClear: best.boardClear };
}

export function handHasBoardClearPath(board, pieces, context = {}) {
  const shapes = pieces.map((piece) =>
    PIECE_SHAPES.find((shape) => shape.id === piece.shapeId) || {
      id: piece.shapeId || piece.id,
      cells: piece.cells,
    },
  );
  return evaluateHandFun(board, shapes, context).boardClear;
}

export function generatePiece(rng = Math.random, id = String(Date.now()), context = {}) {
  const shape = weightedShape(rng, context);
  return {
    id,
    shapeId: shape.id,
    name: shape.name,
    cells: shape.cells.map((cell) => [...cell]),
    colorIndex: Math.floor(rng() * 4),
    solid: false,
    bonus: false,
    placed: false,
  };
}

function createDirectorPool(context) {
  const phase = getGamePhase(context);
  const hints = getNearClearHints(context.board);
  const fittingShapes = PIECE_SHAPES.filter((shape) => shapeCanFit(context.board, shape));
  const candidates = fittingShapes.length ? fittingShapes : PIECE_SHAPES;
  const opportunities = candidates.map((shape) => [shape.id, analyzeShapeOpportunity(context.board, shape)]);
  const clearOpportunities = Object.fromEntries(
    opportunities.map(([shapeId, opportunity]) => [shapeId, opportunity.lines]),
  );
  const boardClearOpportunities = Object.fromEntries(
    opportunities.map(([shapeId, opportunity]) => [shapeId, opportunity.boardClear]),
  );
  return candidates.map((shape) => ({
    shape,
    weight: getAdaptiveShapeWeight(shape, {
      ...context,
      phase,
      hints,
      clearOpportunities,
      boardClearOpportunities,
    }),
  }));
}

function pickDirectorShape(pool, rng, options = {}) {
  const weighted = pool.map(({ shape, weight }) => {
    let adjusted = weight;
    if (options.selectedShapeIds?.includes(shape.id)) adjusted *= 0.22;
    if (options.recentAwkward && AWKWARD_SHAPES.has(shape.id)) adjusted *= 0.42;
    if (options.suppressAwkward && AWKWARD_SHAPES.has(shape.id)) adjusted *= 0.08;
    if (options.suppressLarge && LARGE_SHAPES.has(shape.id)) adjusted *= 0.06;
    return { shape, weight: Math.max(0.002, adjusted) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let pick = rng() * total;
  for (const item of weighted) {
    pick -= item.weight;
    if (pick <= 0) return item.shape;
  }
  return weighted[0].shape;
}

export function generateHand(rng = Math.random, seed = Date.now(), context = {}) {
  const phase = getGamePhase(context);
  const previousShapeIds = context.previousShapeIds || [];
  const candidateCount = 30;
  const candidateSets = [];
  const directorPool = createDirectorPool(context);
  const directorCache = new Map();
  const dreamSets = DREAM_SET_IDS
    .map((ids) => ids.map((id) => PIECE_SHAPES.find((shape) => shape.id === id)))
    .filter((shapes) => shapes.every((shape) => shape && shapeCanFit(context.board, shape)));

  if (phase === GAME_PHASES.warmup || (Number(context.boardClearPity) || 0) >= 8) {
    candidateSets.push(...dreamSets);
  }

  if (phase === GAME_PHASES.warmup && getBoardFullness(context.board) <= 0.08 && dreamSets.length) {
    const selectedDream = dreamSets[Math.floor(rng() * dreamSets.length)];
    return selectedDream.map((shape, slot) => ({
      id: `p-${seed}-${slot}-${Math.floor(rng() * 100000)}`,
      shapeId: shape.id,
      name: shape.name,
      cells: shape.cells.map((cell) => [...cell]),
      colorIndex: Math.floor(rng() * 4),
      solid: false,
      bonus: false,
      placed: false,
    }));
  }

  for (let candidateIndex = candidateSets.length; candidateIndex < candidateCount; candidateIndex += 1) {
    const shapes = [];
    for (let slot = 0; slot < 3; slot += 1) {
      const awkwardCount = shapes.filter((shape) => AWKWARD_SHAPES.has(shape.id)).length;
      const largeCount = shapes.filter((shape) => LARGE_SHAPES.has(shape.id)).length;
      shapes.push(pickDirectorShape(directorPool, rng, {
        recentAwkward: previousShapeIds.slice(-2).some((id) => AWKWARD_SHAPES.has(id)),
        suppressAwkward: awkwardCount >= (phase === GAME_PHASES.warmup ? 1 : 2),
        suppressLarge: largeCount >= (phase === GAME_PHASES.highScore ? 2 : 1),
        selectedShapeIds: [...previousShapeIds, ...shapes.map((shape) => shape.id)],
      }));
    }
    candidateSets.push(shapes);
  }

  const weightByShape = new Map(directorPool.map(({ shape, weight }) => [shape.id, weight]));
  const simulationCandidates = candidateSets
    .map((shapes) => ({
      shapes,
      quickScore:
        shapes.reduce((sum, shape) => sum + (weightByShape.get(shape.id) || 0), 0) +
        (dreamSets.includes(shapes) ? 1200 : 0),
    }))
    .sort((a, b) => b.quickScore - a.quickScore)
    .slice(0, 6);
  const ranked = simulationCandidates
    .map(({ shapes }) => ({
      shapes,
      ...evaluateHandFun(context.board, shapes, { ...context, phase, directorCache }),
    }))
    .sort((a, b) => b.score - a.score);
  const topCount = Math.max(3, Math.ceil(ranked.length * (phase === GAME_PHASES.warmup ? 0.14 : 0.22)));
  const selected = ranked[Math.floor((rng() ** 2) * topCount)] || ranked[0];

  return selected.shapes.map((shape, slot) => ({
    id: `p-${seed}-${slot}-${Math.floor(rng() * 100000)}`,
    shapeId: shape.id,
    name: shape.name,
    cells: shape.cells.map((cell) => [...cell]),
    colorIndex: Math.floor(rng() * 4),
    solid: false,
    bonus: false,
    placed: false,
  }));
}

export function createBonusState(active = false) {
  return active
    ? { active: true, movesLeft: BONUS_STAGE.maxMoves, misses: 0 }
    : { active: false, movesLeft: 0, misses: 0 };
}

export function bonusizePieces(pieces, colorIndex = BONUS_STAGE.colorIndex) {
  return pieces.map((piece) =>
    piece?.placed
      ? piece
      : {
          ...piece,
          colorIndex,
          solid: true,
          bonus: true,
        },
  );
}

export function getPieceColorIndex(piece, cellIndex) {
  return piece?.solid ? piece.colorIndex : (piece.colorIndex + cellIndex) % 4;
}

export function shouldStartBonusStage({ previousLines, nextLines, nextCombo, lineCount, bonusActive }) {
  if (bonusActive || lineCount <= 0) return false;
  const crossedMilestone =
    Math.floor(previousLines / BONUS_STAGE.lineMilestone) < Math.floor(nextLines / BONUS_STAGE.lineMilestone);
  return nextCombo >= BONUS_STAGE.triggerCombo || crossedMilestone;
}

export function advanceBonusStage(bonus, lineCount) {
  if (!bonus?.active) return createBonusState(false);
  const movesLeft = Math.max(0, (bonus.movesLeft || BONUS_STAGE.maxMoves) - 1);
  const misses = lineCount > 0 ? 0 : (bonus.misses || 0) + 1;
  if (movesLeft <= 0 || misses >= BONUS_STAGE.maxMisses) return createBonusState(false);
  return { active: true, movesLeft, misses };
}

export function advanceComboState(currentCombo, currentMisses, lineCount) {
  if (lineCount > 0) {
    return { combo: currentCombo + 1, misses: 0 };
  }

  if (currentCombo <= 0) return { combo: 0, misses: 0 };
  const misses = currentMisses + 1;
  return misses >= COMBO_MISS_LIMIT ? { combo: 0, misses: 0 } : { combo: currentCombo, misses };
}

export function createRun(rng = Math.random, bestAtStart = 0) {
  const board = createEmptyBoard();
  return {
    board,
    pieces: generateHand(rng, Date.now(), { board, moves: 0, score: 0, totalLines: 0 }),
    score: 0,
    combo: 0,
    biggestCombo: 0,
    comboMisses: 0,
    bonus: createBonusState(false),
    totalLines: 0,
    coinsEarned: 0,
    xpEarned: 0,
    moves: 0,
    boardClearPity: 0,
    boardClears: 0,
    isOver: false,
    startedAt: Date.now(),
    bestAtStart: Math.max(0, Number(bestAtStart) || 0),
  };
}

export function canPlacePiece(board, piece, row, col) {
  if (!piece || piece.placed) return false;
  return piece.cells.every(([cellRow, cellCol]) => {
    const nextRow = row + cellRow;
    const nextCol = col + cellCol;
    return (
      nextRow >= 0 &&
      nextRow < BOARD_SIZE &&
      nextCol >= 0 &&
      nextCol < BOARD_SIZE &&
      !board[nextRow][nextCol]
    );
  });
}

export function placePiece(board, piece, row, col, skinId = "classic") {
  const nextBoard = cloneBoard(board);
  piece.cells.forEach(([cellRow, cellCol], index) => {
    nextBoard[row + cellRow][col + cellCol] = {
      skin: skinId,
      colorIndex: getPieceColorIndex(piece, index),
    };
  });
  return nextBoard;
}

export function findCompletedLines(board) {
  const rows = [];
  const cols = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    if (board[row].every(Boolean)) rows.push(row);
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let full = true;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      if (!board[row][col]) {
        full = false;
        break;
      }
    }
    if (full) cols.push(col);
  }

  return { rows, cols, count: rows.length + cols.length };
}

export function getPlacementLines(board, piece, row, col, skinId = "classic") {
  if (!canPlacePiece(board, piece, row, col)) return { rows: [], cols: [], count: 0 };
  return findCompletedLines(placePiece(board, piece, row, col, skinId));
}

export function clearCompletedLines(board, completed) {
  const nextBoard = cloneBoard(board);
  const clearedCells = [];
  const clearRows = new Set(completed.rows);
  const clearCols = new Set(completed.cols);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (clearRows.has(row) || clearCols.has(col)) {
        if (nextBoard[row][col]) clearedCells.push([row, col]);
        nextBoard[row][col] = null;
      }
    }
  }

  return { board: nextBoard, clearedCells };
}

export function canAnyPieceFit(board, pieces) {
  return pieces.some((piece) => {
    if (!piece || piece.placed) return false;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (canPlacePiece(board, piece, row, col)) return true;
      }
    }
    return false;
  });
}

export function getPlacementReward(cellCount, lineCount, currentCombo, options = {}) {
  const nextCombo = lineCount > 0 ? currentCombo + 1 : currentCombo;
  const comboMultiplier = Math.max(1, nextCombo);
  const lineTable = [0, 100, 260, 460, 760, 1100, 1500, 1950, 2450];
  const lineScore = (lineTable[lineCount] || lineCount * 320) * comboMultiplier;
  const bonusMultiplier = options.bonusActive ? BONUS_STAGE.scoreMultiplier : 1;
  const score = Math.round((cellCount * 10 + lineScore) * bonusMultiplier);
  const coins = Math.max(0, Math.floor(score / 90) + lineCount * 2 + (nextCombo >= 2 ? nextCombo * 3 : 0));
  const xp = Math.max(4, Math.floor(score / 7));

  return {
    score,
    coins,
    xp,
    nextCombo,
    comboMultiplier,
    bonusMultiplier,
    lineCount,
  };
}

export function getBoardClearReward(combo = 1, phase = GAME_PHASES.warmup, streak = 1) {
  const comboMultiplier = Math.max(1, Number(combo) || 1);
  const clearStreak = Math.max(1, Number(streak) || 1);
  const phaseBase = {
    [GAME_PHASES.warmup]: 1500,
    [GAME_PHASES.normal]: 2500,
    [GAME_PHASES.pressure]: 4000,
    [GAME_PHASES.highScore]: 5000,
  }[phase] || 1500;
  const streakBonus = (clearStreak - 1) * 750;
  const score = phaseBase + comboMultiplier * 250 + streakBonus;

  return {
    score,
    coins: 18 + comboMultiplier * 3 + clearStreak * 5 + Math.floor(phaseBase / 500),
    xp: Math.floor(score / 5),
    phaseBonus: phaseBase,
    streakBonus,
  };
}

export function comboLabel(combo) {
  if (combo >= 5) return "Ultra Blast";
  if (combo >= 3) return "Mega Blast";
  if (combo >= 2) return `Combo x${combo}`;
  return "";
}

export function levelThreshold(level) {
  return 260 + level * 140;
}

export function createDailyState(date = todayKey()) {
  return {
    date,
    missions: Object.fromEntries(
      MISSION_DEFS.map((mission) => [mission.id, { progress: 0, claimed: false }]),
    ),
  };
}

export function createInitialProfile(date = todayKey()) {
  return {
    highScore: 0,
    coins: 120,
    level: 1,
    xp: 0,
    chestProgress: 0,
    ownedSkins: ["classic"],
    selectedSkin: "classic",
    powerups: { hammer: 3, shuffle: 2, bomb: 1 },
    daily: createDailyState(date),
    tutorialSeen: false,
    settings: { sound: true, voice: false, music: false, haptics: true },
  };
}

export function normalizeProfile(rawProfile, date = todayKey()) {
  const defaults = createInitialProfile(date);
  const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const ownedSkins = Array.isArray(raw.ownedSkins) && raw.ownedSkins.length ? raw.ownedSkins : defaults.ownedSkins;
  const selectedSkin = ownedSkins.includes(raw.selectedSkin) ? raw.selectedSkin : "classic";
  const daily = raw.daily?.date === date ? raw.daily : createDailyState(date);

  return {
    ...defaults,
    ...raw,
    highScore: Number(raw.highScore) || 0,
    coins: Number.isFinite(raw.coins) ? raw.coins : defaults.coins,
    level: Math.max(1, Number(raw.level) || 1),
    xp: Math.max(0, Number(raw.xp) || 0),
    chestProgress: Math.min(CHEST_MAX, Math.max(0, Number(raw.chestProgress) || 0)),
    ownedSkins,
    selectedSkin,
    powerups: { ...defaults.powerups, ...(raw.powerups || {}) },
    daily,
    tutorialSeen: Boolean(raw.tutorialSeen),
    settings: { ...defaults.settings, ...(raw.settings || {}) },
  };
}

export function applyXP(profile, xpGain) {
  let xp = profile.xp + xpGain;
  let level = profile.level;
  let bonusCoins = 0;
  let levelsGained = 0;

  while (xp >= levelThreshold(level)) {
    xp -= levelThreshold(level);
    level += 1;
    levelsGained += 1;
    bonusCoins += 45 + level * 5;
  }

  return {
    profile: {
      ...profile,
      level,
      xp,
      coins: profile.coins + bonusCoins,
    },
    levelsGained,
    bonusCoins,
  };
}

function countMilestones(previousValue, nextValue, every) {
  return Math.floor(nextValue / every) - Math.floor(previousValue / every);
}

export function applyLineRewards(profile, previousLines, addedLines) {
  if (addedLines <= 0) {
    return { profile, bonusCoins: 0, chestAdded: 0, chestReady: profile.chestProgress >= CHEST_MAX };
  }

  const nextLines = previousLines + addedLines;
  const streakBonuses = countMilestones(previousLines, nextLines, 5);
  const chestBonuses = countMilestones(previousLines, nextLines, 10);
  const bonusCoins = streakBonuses * 25;
  const chestAdded = addedLines + chestBonuses;
  const chestProgress = Math.min(CHEST_MAX, profile.chestProgress + chestAdded);

  return {
    profile: {
      ...profile,
      coins: profile.coins + bonusCoins,
      chestProgress,
    },
    bonusCoins,
    chestAdded,
    chestReady: chestProgress >= CHEST_MAX,
  };
}

export function updateDailyProgress(daily, event, date = todayKey()) {
  const base = daily?.date === date ? daily : createDailyState(date);
  const missions = { ...base.missions };

  missions.clear20 = {
    ...missions.clear20,
    progress: Math.min(MISSION_DEFS[0].target, (missions.clear20?.progress || 0) + (event.linesCleared || 0)),
  };
  missions.score1000 = {
    ...missions.score1000,
    progress: Math.min(MISSION_DEFS[1].target, Math.max(missions.score1000?.progress || 0, event.score || 0)),
  };
  missions.combo3 = {
    ...missions.combo3,
    progress: Math.min(MISSION_DEFS[2].target, (missions.combo3?.progress || 0) + (event.comboEvent || 0)),
  };

  return { ...base, missions };
}

export function applyGameProgress(profile, event, date = todayKey()) {
  let nextProfile = {
    ...profile,
    highScore: Math.max(profile.highScore, event.score),
    coins: profile.coins + event.coins,
  };

  const lineRewards = applyLineRewards(nextProfile, event.previousLines, event.linesCleared);
  nextProfile = lineRewards.profile;

  const xpRewards = applyXP(nextProfile, event.xp);
  nextProfile = xpRewards.profile;

  nextProfile = {
    ...nextProfile,
    daily: updateDailyProgress(nextProfile.daily, event, date),
  };

  return { profile: nextProfile, lineRewards, xpRewards };
}

export function claimMission(profile, missionId) {
  const mission = MISSION_DEFS.find((item) => item.id === missionId);
  const current = profile.daily.missions[missionId];
  if (!mission || !current || current.claimed || current.progress < mission.target) {
    return { profile, claimed: false };
  }

  return {
    profile: {
      ...profile,
      coins: profile.coins + mission.reward,
      daily: {
        ...profile.daily,
        missions: {
          ...profile.daily.missions,
          [missionId]: { ...current, claimed: true },
        },
      },
    },
    claimed: true,
    reward: mission.reward,
  };
}

export function buySkin(profile, skinId) {
  const skin = SKINS.find((item) => item.id === skinId);
  if (!skin || profile.ownedSkins.includes(skinId) || profile.coins < skin.price) {
    return { profile, purchased: false };
  }

  return {
    profile: {
      ...profile,
      coins: profile.coins - skin.price,
      ownedSkins: [...profile.ownedSkins, skinId],
      selectedSkin: skinId,
    },
    purchased: true,
  };
}

export function selectSkin(profile, skinId) {
  if (!profile.ownedSkins.includes(skinId)) return { profile, selected: false };
  return { profile: { ...profile, selectedSkin: skinId }, selected: true };
}

export function buyPowerup(profile, powerupId) {
  const powerup = POWERUPS[powerupId];
  if (!powerup || profile.coins < powerup.cost) {
    return { profile, purchased: false };
  }

  return {
    profile: {
      ...profile,
      coins: profile.coins - powerup.cost,
      powerups: {
        ...profile.powerups,
        [powerupId]: (profile.powerups[powerupId] || 0) + 1,
      },
    },
    purchased: true,
  };
}

export function spendPowerup(profile, powerupId) {
  if ((profile.powerups[powerupId] || 0) <= 0) return { profile, spent: false };
  return {
    profile: {
      ...profile,
      powerups: {
        ...profile.powerups,
        [powerupId]: profile.powerups[powerupId] - 1,
      },
    },
    spent: true,
  };
}

export function removeCell(board, row, col) {
  if (!board[row]?.[col]) return { board, removed: 0 };
  const nextBoard = cloneBoard(board);
  nextBoard[row][col] = null;
  return { board: nextBoard, removed: 1 };
}

export function clearArea(board, centerRow, centerCol, radius = 1) {
  const nextBoard = cloneBoard(board);
  let removed = 0;

  for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
    for (let col = centerCol - radius; col <= centerCol + radius; col += 1) {
      if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && nextBoard[row][col]) {
        nextBoard[row][col] = null;
        removed += 1;
      }
    }
  }

  return { board: nextBoard, removed };
}

export function openChest(profile, rng = Math.random) {
  if (profile.chestProgress < CHEST_MAX) {
    return { profile, opened: false };
  }

  const lockedSkins = SKINS.filter((skin) => skin.price > 0 && !profile.ownedSkins.includes(skin.id));
  const shouldGrantSkin = lockedSkins.length > 0 && rng() < 0.28;

  if (shouldGrantSkin) {
    const skin = lockedSkins[Math.floor(rng() * lockedSkins.length)];
    return {
      profile: {
        ...profile,
        chestProgress: 0,
        ownedSkins: [...profile.ownedSkins, skin.id],
      },
      opened: true,
      reward: { type: "skin", skinId: skin.id, label: skin.name },
    };
  }

  const coins = 80 + Math.floor(rng() * 121);
  return {
    profile: {
      ...profile,
      chestProgress: 0,
      coins: profile.coins + coins,
    },
    opened: true,
    reward: { type: "coins", amount: coins, label: `${coins} coins` },
  };
}

export function reviveRunFromStorage(rawRun) {
  if (!rawRun || typeof rawRun !== "object" || !Array.isArray(rawRun.board) || !Array.isArray(rawRun.pieces)) {
    return null;
  }

  if (rawRun.board.length !== BOARD_SIZE || rawRun.board.some((row) => !Array.isArray(row) || row.length !== BOARD_SIZE)) {
    return null;
  }

  return {
    board: rawRun.board,
    pieces: rawRun.pieces,
    score: Number(rawRun.score) || 0,
    combo: Number(rawRun.combo) || 0,
    biggestCombo: Math.max(Number(rawRun.biggestCombo) || 0, Number(rawRun.combo) || 0),
    comboMisses: Math.max(0, Number(rawRun.comboMisses) || 0),
    bonus: rawRun.bonus?.active
      ? {
          active: true,
          movesLeft: Math.max(1, Math.min(BONUS_STAGE.maxMoves, Number(rawRun.bonus.movesLeft) || BONUS_STAGE.maxMoves)),
          misses: Math.max(0, Math.min(BONUS_STAGE.maxMisses - 1, Number(rawRun.bonus.misses) || 0)),
        }
      : createBonusState(false),
    totalLines: Number(rawRun.totalLines) || 0,
    coinsEarned: Number(rawRun.coinsEarned) || 0,
    xpEarned: Number(rawRun.xpEarned) || 0,
    moves: Number(rawRun.moves) || 0,
    boardClearPity: Math.max(0, Number(rawRun.boardClearPity) || 0),
    boardClears: Math.max(0, Number(rawRun.boardClears) || 0),
    isOver: Boolean(rawRun.isOver),
    startedAt: Number(rawRun.startedAt) || Date.now(),
    bestAtStart: Math.max(0, Number(rawRun.bestAtStart) || 0),
  };
}

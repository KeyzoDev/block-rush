import {
  DEFAULT_SKIN_ID,
  SKINS,
  getSkin,
  isSkinId,
} from "../theme/skins.js";
import {
  applyProgressEvent,
  claimDailyMission,
  equipTheme,
  normalizeProgress,
  unlockTheme,
} from "../progression/progression.js";

export { SKINS, getSkin };

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

export const POWERUPS = {
  hammer: { id: "hammer", name: "Hammer", cost: 90 },
  shuffle: { id: "shuffle", name: "Shuffle", cost: 120 },
  bomb: { id: "bomb", name: "Bomb", cost: 150 },
};

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
const LONG_LINE_SHAPES = new Set(["line4-h", "line4-v", "line5-h", "line5-v"]);
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
  ["tri-h", "line5-h", "box2"],
  ["tri-v", "line5-v", "box2"],
  ["tri-h", "line5-h", "corner-a"],
  ["tri-v", "line5-v", "corner-b"],
  ["tri-h", "line5-h", "t4"],
  ["tri-v", "line5-v", "zig"],
];

export const GAME_PHASES = {
  warmup: "warmup",
  normal: "normal",
  pressure: "pressure",
  highScore: "highScore",
};

export function getPieceCategory(shapeOrId) {
  const id = typeof shapeOrId === "string" ? shapeOrId : shapeOrId?.id;
  if (id === "single") return "single";
  if (id === "duo-h" || id === "duo-v") return "duo";
  if (id === "tri-h" || id === "tri-v") return "shortLine";
  if (LONG_LINE_SHAPES.has(id)) return "longLine";
  if (id === "box2") return "square2";
  if (id === "box3") return "square3";
  if (id === "corner-a" || id === "corner-b") return "corner";
  if (id === "l4-a" || id === "l4-b") return "hook";
  if (id === "t4") return "tee";
  if (id === "zig" || id === "step") return "zig";
  return "other";
}

function isCompactCategory(category) {
  return ["square2", "corner", "hook", "tee", "zig"].includes(category);
}

export function todayKey(date = new Date()) {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
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
  const recentShapeIds = (context.recentShapeIds || []).slice(-12);
  const category = getPieceCategory(shape);
  const recentCategories = recentShapeIds.map(getPieceCategory);
  const categoryRecentCount = recentCategories.filter((item) => item === category).length;
  const exactRecentCount = recentShapeIds.filter((id) => id === shape.id).length;

  if (phase === GAME_PHASES.warmup) {
    if (cellCount <= 3) weight *= 1.75;
    if (cellCount === 4 && !AWKWARD_SHAPES.has(shape.id)) weight *= 1.18;
    if (cellCount >= 5) weight *= 0.28;
    if (AWKWARD_SHAPES.has(shape.id)) weight *= 0.42;
    if (LINE_FRIENDLY_SHAPES.has(shape.id)) weight *= 1.08;
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

  if (category === "longLine") weight *= 0.64;
  if (category === "shortLine") weight *= 0.78;
  if (category === "square2") weight *= 1.34;
  if (category === "square3" && fullness < 0.48) weight *= 1.28;
  if (isCompactCategory(category)) weight *= 1.16;

  if (category === "longLine") {
    const recentLongLines = recentCategories.filter((item) => item === "longLine").length;
    if (recentLongLines >= 3) weight *= 0.12;
    else if (recentLongLines >= 2) weight *= 0.28;
    else if (recentLongLines >= 1) weight *= 0.62;
  }
  if (category === "shortLine" && categoryRecentCount >= 3) weight *= 0.48;
  if (category === "square2" && !recentCategories.slice(-9).includes("square2")) weight *= 2.35;
  if (
    category === "square3" &&
    fullness < 0.48 &&
    !recentCategories.slice(-12).includes("square3")
  ) {
    weight *= phase === GAME_PHASES.warmup ? 3.2 : 2.35;
  }
  if (
    ["corner", "hook", "tee", "zig"].includes(category) &&
    !recentCategories.slice(-8).includes(category)
  ) {
    weight *= 1.7;
  }
  if (categoryRecentCount >= 4) weight *= 0.38;
  if (exactRecentCount > 0) weight *= 0.42 ** exactRecentCount;

  if (shape.id === "single" && hints.single > 0) weight *= 1 + Math.min(2.2, hints.single * 0.7);
  if (shape.id === "duo-h" && hints.duoH > 0) weight *= 1 + Math.min(1.7, hints.duoH * 0.55);
  if (shape.id === "duo-v" && hints.duoV > 0) weight *= 1 + Math.min(1.7, hints.duoV * 0.55);
  if (shape.id === "tri-h" && hints.triH > 0) weight *= 1 + Math.min(1.45, hints.triH * 0.45);
  if (shape.id === "tri-v" && hints.triV > 0) weight *= 1 + Math.min(1.45, hints.triV * 0.45);
  if (context.selectedShapeIds?.includes(shape.id)) weight *= 0.22;
  if (context.recentAwkward && AWKWARD_SHAPES.has(shape.id)) weight *= 0.42;
  if (context.suppressAwkward && AWKWARD_SHAPES.has(shape.id)) weight *= 0.08;
  if (context.suppressLarge && LARGE_SHAPES.has(shape.id)) weight *= 0.06;
  if (context.suppressLongLine && LONG_LINE_SHAPES.has(shape.id)) weight *= 0.04;

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
  const categories = shapes.map(getPieceCategory);
  const categoryVariety = new Set(categories).size;
  const longLineCount = categories.filter((category) => category === "longLine").length;
  const totalLineCount = categories.filter((category) =>
    category === "shortLine" || category === "longLine"
  ).length;
  const compactCount = categories.filter(isCompactCategory).length;
  const squareCount = categories.filter((category) =>
    category === "square2" || category === "square3"
  ).length;
  const recentCategories = (context.recentShapeIds || []).slice(-12).map(getPieceCategory);
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
    if (compactCount > 0) score += 760;
    if (squareCount > 0) score += 480;
    if (totalLineCount >= 3) score -= 1200;
  } else {
    score += pity * 24;
  }
  score += categoryVariety * 220;
  score += compactCount * 180;
  score += squareCount * 130;
  if (longLineCount > 1) score -= (longLineCount - 1) * 1200;
  if (totalLineCount >= 3) score -= 780;
  if (
    recentCategories.filter((category) =>
      category === "shortLine" || category === "longLine"
    ).length >= 6
  ) {
    score -= totalLineCount * 460;
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
    if (options.suppressLongLine && LONG_LINE_SHAPES.has(shape.id)) adjusted *= 0.04;
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
  const recentShapeIds = (context.recentShapeIds || previousShapeIds).slice(-12);
  const candidateCount = 30;
  const candidateSets = [];
  const directorPool = createDirectorPool(context);
  const directorCache = new Map();
  const recentCategories = recentShapeIds.map(getPieceCategory);
  const recentLongLines = recentCategories.filter((category) => category === "longLine").length;
  const dreamSets = DREAM_SET_IDS
    .map((ids) => ids.map((id) => PIECE_SHAPES.find((shape) => shape.id === id)))
    .filter((shapes) => shapes.every((shape) => shape && shapeCanFit(context.board, shape)));

  if (phase === GAME_PHASES.warmup && recentLongLines < 2) {
    candidateSets.push(...dreamSets);
  }

  if (
    phase === GAME_PHASES.warmup &&
    getBoardFullness(context.board) <= 0.08 &&
    recentLongLines < 2 &&
    dreamSets.length
  ) {
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
      const longLineCount = shapes.filter((shape) => LONG_LINE_SHAPES.has(shape.id)).length;
      shapes.push(pickDirectorShape(directorPool, rng, {
        recentAwkward: recentShapeIds.slice(-3).some((id) => AWKWARD_SHAPES.has(id)),
        suppressAwkward: awkwardCount >= (phase === GAME_PHASES.warmup ? 1 : 2),
        suppressLarge: largeCount >= (phase === GAME_PHASES.highScore ? 2 : 1),
        suppressLongLine: longLineCount >= 1,
        selectedShapeIds: [...recentShapeIds, ...shapes.map((shape) => shape.id)],
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
      ...evaluateHandFun(context.board, shapes, {
        ...context,
        phase,
        recentShapeIds,
        directorCache,
      }),
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

export function createRun(rng = Math.random, bestAtStart = 0, progressAtStart = {}) {
  const board = createEmptyBoard();
  const pieces = generateHand(rng, Date.now(), {
    board,
    moves: 0,
    score: 0,
    totalLines: 0,
    recentShapeIds: [],
  });
  return {
    board,
    pieces,
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
    boardClearStreak: 0,
    bestBoardClearStreak: 0,
    feverActivations: 0,
    recentShapeIds: pieces.map((piece) => piece.shapeId).slice(-12),
    isOver: false,
    finalized: false,
    resultSummary: null,
    progressEvents: { missions: [], achievements: [] },
    startedAt: Date.now(),
    bestAtStart: Math.max(0, Number(bestAtStart) || 0),
    themeId: progressAtStart.selectedThemeId || DEFAULT_SKIN_ID,
    totalBoardClearsAtStart: Math.max(0, Number(progressAtStart.totalBoardClears) || 0),
    bestBoardClearStreakAtStart: Math.max(
      0,
      Number(progressAtStart.bestBoardClearStreak) || 0,
    ),
    missionProgressAtStart: Object.fromEntries(
      Object.entries(progressAtStart.dailyMissionProgress || {}).map(([id, state]) => [
        id,
        Math.max(0, Number(state?.progress) || 0),
      ]),
    ),
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

export function createInitialProfile(date = todayKey()) {
  return {
    ...normalizeProgress({}, date),
    level: 1,
    xp: 0,
    chestProgress: 0,
    powerups: { hammer: 3, shuffle: 2, bomb: 1 },
    tutorialCompleted: false,
    tutorialSeen: false,
    settings: { sound: true, voice: false, music: false, haptics: true },
  };
}

export function normalizeProfile(rawProfile, date = todayKey()) {
  const defaults = createInitialProfile(date);
  const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const progress = normalizeProgress(raw, date);

  return {
    ...defaults,
    ...progress,
    level: Math.max(1, Number(raw.level) || 1),
    xp: Math.max(0, Number(raw.xp) || 0),
    chestProgress: Math.min(CHEST_MAX, Math.max(0, Number(raw.chestProgress) || 0)),
    powerups: { ...defaults.powerups, ...(raw.powerups || {}) },
    tutorialCompleted: Boolean(raw.tutorialCompleted ?? raw.tutorialSeen),
    tutorialSeen: Boolean(raw.tutorialCompleted ?? raw.tutorialSeen),
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
      totalCoins: profile.totalCoins + bonusCoins,
      lifetimeCoinsEarned: profile.lifetimeCoinsEarned + bonusCoins,
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
      totalCoins: profile.totalCoins + bonusCoins,
      lifetimeCoinsEarned: profile.lifetimeCoinsEarned + bonusCoins,
      chestProgress,
    },
    bonusCoins,
    chestAdded,
    chestReady: chestProgress >= CHEST_MAX,
  };
}

export function applyGameProgress(profile, event, date = todayKey()) {
  const tracked = applyProgressEvent(profile, {
    coinsEarned: event.coins,
    scoreGain: event.scoreGain,
    currentRunScore: event.score,
    linesCleared: event.linesCleared,
    boardClears: event.boardClears,
    comboEvents: event.comboEvent,
    bestCombo: event.bestCombo,
    boardClearStreak: event.boardClearStreak,
    feverActivations: event.feverActivations,
  }, date);
  let nextProfile = tracked.profile;

  const lineRewards = applyLineRewards(nextProfile, event.previousLines, event.linesCleared);
  nextProfile = lineRewards.profile;

  const xpRewards = applyXP(nextProfile, event.xp);
  nextProfile = xpRewards.profile;

  return {
    profile: nextProfile,
    lineRewards,
    xpRewards,
    newlyCompletedMissions: tracked.newlyCompletedMissions,
    unlockedAchievements: tracked.unlockedAchievements,
  };
}

export function claimMission(profile, missionId) {
  return claimDailyMission(profile, missionId);
}

export function buySkin(profile, skinId) {
  const result = unlockTheme(profile, skinId);
  return { ...result, purchased: result.unlocked };
}

export function selectSkin(profile, skinId) {
  return equipTheme(profile, skinId);
}

export function buyPowerup(profile, powerupId) {
  const powerup = POWERUPS[powerupId];
  if (!powerup || profile.totalCoins < powerup.cost) {
    return { profile, purchased: false };
  }

  return {
    profile: {
      ...profile,
      totalCoins: profile.totalCoins - powerup.cost,
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

  const lockedSkins = SKINS.filter(
    (skin) =>
      skin.rarity !== "Legendary" &&
      skin.coinPrice > 0 &&
      !profile.unlockedThemeIds.includes(skin.id),
  );
  const shouldGrantSkin = lockedSkins.length > 0 && rng() < 0.28;

  if (shouldGrantSkin) {
    const skin = lockedSkins[Math.floor(rng() * lockedSkins.length)];
    return {
      profile: {
        ...profile,
        chestProgress: 0,
        unlockedThemeIds: [...profile.unlockedThemeIds, skin.id],
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
      totalCoins: profile.totalCoins + coins,
      lifetimeCoinsEarned: profile.lifetimeCoinsEarned + coins,
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
    boardClearStreak: Math.max(
      0,
      Number(rawRun.boardClearStreak) || Number(rawRun.boardClears) || 0,
    ),
    bestBoardClearStreak: Math.max(
      0,
      Number(rawRun.bestBoardClearStreak) || Number(rawRun.boardClears) || 0,
    ),
    feverActivations: Math.max(0, Number(rawRun.feverActivations) || 0),
    recentShapeIds: Array.isArray(rawRun.recentShapeIds)
      ? rawRun.recentShapeIds.filter((id) => typeof id === "string").slice(-12)
      : rawRun.pieces.map((piece) => piece.shapeId).filter(Boolean).slice(-12),
    isOver: Boolean(rawRun.isOver),
    finalized: Boolean(rawRun.finalized),
    resultSummary:
      rawRun.resultSummary && typeof rawRun.resultSummary === "object"
        ? rawRun.resultSummary
        : null,
    progressEvents: {
      missions: Array.isArray(rawRun.progressEvents?.missions)
        ? rawRun.progressEvents.missions.filter((id) => typeof id === "string")
        : [],
      achievements: Array.isArray(rawRun.progressEvents?.achievements)
        ? rawRun.progressEvents.achievements.filter((id) => typeof id === "string")
        : [],
    },
    startedAt: Number(rawRun.startedAt) || Date.now(),
    bestAtStart: Math.max(0, Number(rawRun.bestAtStart) || 0),
    themeId: isSkinId(rawRun.themeId) ? rawRun.themeId : DEFAULT_SKIN_ID,
    totalBoardClearsAtStart: Math.max(0, Number(rawRun.totalBoardClearsAtStart) || 0),
    bestBoardClearStreakAtStart: Math.max(
      0,
      Number(rawRun.bestBoardClearStreakAtStart) || 0,
    ),
    missionProgressAtStart:
      rawRun.missionProgressAtStart && typeof rawRun.missionProgressAtStart === "object"
        ? rawRun.missionProgressAtStart
        : {},
  };
}

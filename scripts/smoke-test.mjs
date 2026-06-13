import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  CHEST_MAX,
  createEmptyBoard,
  createInitialProfile,
  createRun,
  canPlacePiece,
  placePiece,
  findCompletedLines,
  clearCompletedLines,
  canAnyPieceFit,
  getPlacementReward,
  applyGameProgress,
  claimMission,
  buySkin,
  selectSkin,
  buyPowerup,
  spendPowerup,
  removeCell,
  clearArea,
  openChest,
} from "../src/game/gameLogic.js";

const piece = (cells, id = "test") => ({ id, cells, colorIndex: 0, placed: false });
const filled = { skin: "classic", colorIndex: 0 };

function fill(board, cells) {
  const next = board.map((row) => row.slice());
  cells.forEach(([row, col]) => {
    next[row][col] = filled;
  });
  return next;
}

{
  const board = createEmptyBoard();
  const two = piece([[0, 0], [0, 1]]);
  assert.equal(canPlacePiece(board, two, 0, 0), true, "piece should fit on empty board");
  assert.equal(canPlacePiece(board, two, 0, 7), false, "piece should not fit outside board");
  const placed = placePiece(board, two, 0, 0);
  assert.equal(Boolean(placed[0][0]), true, "placement should fill first cell");
  assert.equal(canPlacePiece(placed, two, 0, 0), false, "overlap should be invalid");
}

{
  let board = createEmptyBoard();
  board = fill(board, Array.from({ length: 7 }, (_, col) => [0, col]));
  const placed = placePiece(board, piece([[0, 0]]), 0, 7);
  const completed = findCompletedLines(placed);
  assert.deepEqual(completed.rows, [0], "row clear should be detected");
  assert.equal(clearCompletedLines(placed, completed).board[0].every((cell) => cell === null), true);
}

{
  let board = createEmptyBoard();
  board = fill(board, Array.from({ length: 7 }, (_, row) => [row, 0]));
  const placed = placePiece(board, piece([[0, 0]]), 7, 0);
  const completed = findCompletedLines(placed);
  assert.deepEqual(completed.cols, [0], "column clear should be detected");
}

{
  let board = createEmptyBoard();
  board = fill(board, [
    ...Array.from({ length: 7 }, (_, col) => [0, col]),
    ...Array.from({ length: 7 }, (_, row) => [row + 1, 7]),
  ]);
  const placed = placePiece(board, piece([[0, 0]]), 0, 7);
  const completed = findCompletedLines(placed);
  assert.equal(completed.count, 2, "multi-line clear should be detected");
}

{
  const board = fill(createEmptyBoard(), Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => [
    Math.floor(index / BOARD_SIZE),
    index % BOARD_SIZE,
  ]));
  assert.equal(canAnyPieceFit(board, [piece([[0, 0]])]), false, "game over should detect no fit");
}

{
  const reward = getPlacementReward(4, 2, 1);
  assert.ok(reward.score > 0, "score should increase");
  assert.ok(reward.coins > 0, "coins should increase on clear");
  assert.equal(reward.nextCombo, 2, "combo should increase after consecutive clear");

  const profile = createInitialProfile("2026-06-13");
  const result = applyGameProgress(profile, {
    score: reward.score,
    coins: reward.coins,
    xp: 900,
    previousLines: 4,
    linesCleared: 6,
    comboEvent: 1,
  }, "2026-06-13");
  assert.ok(result.profile.coins > profile.coins, "profile coins should update");
  assert.ok(result.profile.level > profile.level, "level should increase with enough XP");
  assert.ok(result.profile.chestProgress > 0, "chest should gain progress");
  assert.equal(result.profile.daily.missions.clear20.progress, 6, "mission lines should update");
}

{
  const profile = createInitialProfile("2026-06-13");
  const ready = {
    ...profile,
    daily: {
      ...profile.daily,
      missions: {
        ...profile.daily.missions,
        clear20: { progress: 20, claimed: false },
      },
    },
  };
  const claimed = claimMission(ready, "clear20");
  assert.equal(claimed.claimed, true, "mission should be claimable");
  assert.ok(claimed.profile.coins > ready.coins, "mission should grant coins");
}

{
  const profile = { ...createInitialProfile("2026-06-13"), coins: 1000 };
  const purchased = buySkin(profile, "neon");
  assert.equal(purchased.purchased, true, "skin purchase should work");
  assert.equal(selectSkin(purchased.profile, "neon").selected, true, "skin selection should work");
}

{
  const profile = { ...createInitialProfile("2026-06-13"), coins: 500 };
  const bought = buyPowerup(profile, "hammer");
  assert.equal(bought.purchased, true, "power-up purchase should work");
  const spent = spendPowerup(bought.profile, "hammer");
  assert.equal(spent.spent, true, "power-up spend should work");

  const board = placePiece(createEmptyBoard(), piece([[0, 0]]), 3, 3);
  assert.equal(removeCell(board, 3, 3).removed, 1, "hammer should remove a cell");
  const areaBoard = fill(createEmptyBoard(), [[2, 2], [2, 3], [3, 2], [3, 3]]);
  assert.equal(clearArea(areaBoard, 2, 2).removed, 4, "bomb should clear a 3x3 area");
}

{
  const profile = { ...createInitialProfile("2026-06-13"), chestProgress: CHEST_MAX };
  const opened = openChest(profile, () => 0.9);
  assert.equal(opened.opened, true, "chest should open when full");
  assert.equal(opened.profile.chestProgress, 0, "chest progress should reset");
}

{
  const run = createRun(() => 0.2);
  assert.equal(run.board.length, BOARD_SIZE, "restart should create a fresh board");
  assert.equal(run.score, 0, "restart should reset score");
  assert.equal(run.pieces.length, 3, "restart should generate three pieces");
}

console.log("Smoke tests passed");

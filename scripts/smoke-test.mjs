import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  BONUS_STAGE,
  CHEST_MAX,
  advanceBonusStage,
  advanceComboState,
  bonusizePieces,
  createEmptyBoard,
  createInitialProfile,
  createRun,
  canPlacePiece,
  placePiece,
  findCompletedLines,
  clearCompletedLines,
  canAnyPieceFit,
  getPlacementReward,
  getPlacementLines,
  applyGameProgress,
  claimMission,
  buySkin,
  selectSkin,
  buyPowerup,
  spendPowerup,
  removeCell,
  clearArea,
  openChest,
  normalizeProfile,
  shouldStartBonusStage,
} from "../src/game/gameLogic.js";
import { getDragLift, getPlacementCell } from "../src/game/dragPlacement.js";

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
  const profile = createInitialProfile("2026-06-18");
  assert.equal(profile.tutorialSeen, false, "tutorial should be shown for a new player");
  assert.equal(
    normalizeProfile({ ...profile, tutorialSeen: true }, "2026-06-18").tutorialSeen,
    true,
    "tutorial completion should persist",
  );
}

{
  const metrics = {
    left: 10,
    top: 20,
    width: 320,
    height: 320,
    cellWidth: 40,
    cellHeight: 40,
  };
  assert.deepEqual(
    getPlacementCell(piece([[0, 0]]), { x: 150, y: 160 }, metrics),
    { row: 3, col: 3 },
    "drag target should snap to the nearest board cell",
  );
  assert.deepEqual(
    getPlacementCell(piece([[0, 0], [0, 1]]), { x: 150, y: 160 }, metrics),
    { row: 3, col: 3 },
    "even-width pieces should use a centered nearest-cell anchor",
  );
  assert.deepEqual(
    getPlacementCell(piece([[0, 0], [0, 1], [0, 2]]), { x: 12, y: 80 }, metrics),
    { row: 1, col: 0 },
    "edge assist should keep a piece placeable on the first column",
  );
  assert.equal(
    getPlacementCell(piece([[0, 0]]), { x: -40, y: 80 }, metrics),
    null,
    "drag target should clear when the pointer is far outside the board",
  );
  assert.equal(getDragLift(30), 68, "small boards should retain finger clearance");
  assert.equal(getDragLift(50), 88, "large boards should cap finger clearance");
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
  assert.deepEqual(
    getPlacementLines(board, piece([[0, 0]]), 0, 7).rows,
    [0],
    "placement preview should match the resulting row clear",
  );
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
  assert.equal(getPlacementReward(3, 0, 2).nextCombo, 2, "combo should not immediately reset on non-clear move");
  assert.equal(
    getPlacementReward(4, 1, 2, { bonusActive: true }).bonusMultiplier,
    BONUS_STAGE.scoreMultiplier,
    "bonus stage should apply score multiplier",
  );
  assert.equal(
    shouldStartBonusStage({ previousLines: 4, nextLines: 5, nextCombo: 3, lineCount: 1, bonusActive: false }),
    true,
    "combo x3 should trigger bonus stage",
  );
  assert.equal(
    advanceBonusStage(advanceBonusStage({ active: true, movesLeft: 5, misses: 0 }, 0), 0).active,
    false,
    "bonus stage should end after two non-clear moves",
  );
  assert.deepEqual(
    advanceComboState(2, 2, 0),
    { combo: 0, misses: 0 },
    "combo should expire after the third non-clear placement",
  );
  assert.deepEqual(
    advanceComboState(2, 2, 1),
    { combo: 3, misses: 0 },
    "a clear should extend the combo and reset misses",
  );
  assert.equal(bonusizePieces([piece([[0, 0], [0, 1]])])[0].solid, true, "bonus pieces should use one color");

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

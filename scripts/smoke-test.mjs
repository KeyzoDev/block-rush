import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BOARD_SIZE,
  BONUS_STAGE,
  CHEST_MAX,
  EARLY_BOARD_CLEAR_ASSIST,
  PIECE_SHAPES,
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
  getAdaptiveShapeWeight,
  getBoardFullness,
  getBoardClearReward,
  getBoardClearAssistLevel,
  getGamePhase,
  getPieceCategory,
  handHasBoardClearPath,
  getShapeClearOpportunity,
  getShapeBoardClearOpportunity,
  GAME_PHASES,
  isBoardEmpty,
  generateHand,
  evaluateHandFun,
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
import {
  DEFAULT_SKIN_ID,
  SKINS,
  getSkin,
  getSkinCssVariables,
  isSkinId,
} from "../src/theme/skins.js";
import {
  applyProgressEvent,
  createDailyMissionProgress,
  finalizeRunProgress,
  getMissionDefinition,
  getThemeUnlockStatus,
  normalizeProgress,
} from "../src/progression/progression.js";
import {
  copyResultText,
  createResultShareText,
} from "../src/share/resultShare.js";

const piece = (cells, id = "test") => ({ id, cells, colorIndex: 0, placed: false });
const filled = { skin: "classic", colorIndex: 0 };

function fill(board, cells) {
  const next = board.map((row) => row.slice());
  cells.forEach(([row, col]) => {
    next[row][col] = filled;
  });
  return next;
}

function seededRng(seed) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

{
  const profile = createInitialProfile("2026-06-18");
  assert.equal(profile.tutorialSeen, false, "tutorial should be shown for a new player");
  assert.equal(profile.tutorialCompleted, false, "new players should start with tutorial incomplete");
  assert.equal(
    normalizeProfile({ tutorialSeen: true }, "2026-06-18").tutorialCompleted,
    true,
    "legacy tutorial state should migrate",
  );

  const migrated = normalizeProfile(
    {
      ownedSkins: ["neon", "removed-skin", "neon"],
      selectedSkin: "removed-skin",
      tutorialSeen: true,
    },
    "2026-06-18",
  );
  assert.deepEqual(
    migrated.unlockedThemeIds,
    [DEFAULT_SKIN_ID, "neon"],
    "profile migration should remove obsolete and duplicate skin ids",
  );
  assert.equal(
    migrated.selectedThemeId,
    DEFAULT_SKIN_ID,
    "profile migration should fall back to the default skin",
  );
}

{
  const text = createResultShareText(
    {
      score: 42500,
      boardClears: 7,
      bestBoardClearStreak: 3,
      biggestCombo: 10,
      bestAtStart: 40000,
    },
    { bestScore: 42500 },
    "Galaxy Rush",
  );
  assert.match(text, /42,500/);
  assert.match(text, /Board Clears: 7/);
  assert.match(text, /Best Streak: x3/);
  assert.match(text, /New Best!/);
  let copiedText = "";
  assert.equal(
    await copyResultText(text, { writeText: async (value) => { copiedText = value; } }),
    true,
  );
  assert.equal(copiedText, text);
  assert.equal(await copyResultText(text, null), false);

  const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url)));
  assert.equal(manifest.name, "Block Rush");
  assert.equal(manifest.short_name, "Block Rush");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.ok(
    manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"),
    "manifest should include a maskable Android icon",
  );

  const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(indexHtml, /manifest\.webmanifest/);
  assert.match(indexHtml, /favicon-32\.png/);
  assert.match(indexHtml, /apple-touch-icon\.png/);
  assert.match(indexHtml, /block-rush-logo\.webp/);

  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /icon-maskable-512\.png/);
  assert.match(serviceWorker, /block-rush-logo\.webp/);
  assert.match(serviceWorker, /voice-manifest\.json/);

  const voiceManifest = JSON.parse(
    await readFile(new URL("../public/audio/voice/voice-manifest.json", import.meta.url)),
  );
  assert.ok(Array.isArray(voiceManifest.board_clear));
  assert.ok(Array.isArray(voiceManifest.fever));
}

{
  assert.equal(getSkin("missing").id, DEFAULT_SKIN_ID, "unknown skins should use the default");
  assert.equal(isSkinId("galaxy"), true, "registered skin ids should be discoverable");
  assert.equal(isSkinId("missing"), false, "unknown skin ids should be rejected");
  for (const skin of SKINS) {
    const variables = getSkinCssVariables(skin);
    assert.equal(variables["--skin-0"], skin.swatches[0]);
    assert.ok(variables["--theme-bg-start"], `${skin.id} should expose background tokens`);
    assert.ok(variables["--theme-board-start"], `${skin.id} should expose board tokens`);
    assert.ok(variables["--theme-text"], `${skin.id} should expose readable text tokens`);
    assert.ok(skin.visual.blockMotif, `${skin.id} should expose a block motif`);
    assert.ok(skin.visual.boardClear.preset, `${skin.id} should expose Board Clear VFX`);
    assert.ok(skin.visual.fever.preset, `${skin.id} should expose Fever VFX`);
    assert.ok(variables["--theme-clear-glow"], `${skin.id} should expose VFX color tokens`);
  }
  for (const benchmarkId of ["classic", "watermelon", "galaxy", "gold"]) {
    assert.equal(getSkin(benchmarkId).visual.benchmark, true, `${benchmarkId} should be a benchmark theme`);
  }
}

{
  const dailyA = createDailyMissionProgress("2026-06-18");
  const dailyB = createDailyMissionProgress("2026-06-18");
  const dailyNext = createDailyMissionProgress("2026-06-19");
  assert.deepEqual(dailyA.ids, dailyB.ids, "daily mission selection should be deterministic");
  assert.equal(dailyA.ids.length, 3, "daily missions should contain three tasks");
  assert.notDeepEqual(dailyA.ids, dailyNext.ids, "the next day should refresh the mission set");

  const normalized = normalizeProgress({
    coins: 350,
    highScore: 4200,
    ownedSkins: ["classic", "candy", "missing"],
    selectedSkin: "candy",
  }, "2026-06-18");
  assert.equal(normalized.totalCoins, 350, "legacy coins should migrate");
  assert.equal(normalized.bestScore, 4200, "legacy best score should migrate");
  assert.deepEqual(normalized.unlockedThemeIds, ["classic", "candy"]);
  assert.equal(normalized.selectedThemeId, "candy");
  assert.deepEqual(
    normalized.achievements,
    [],
    "legacy progress below achievement thresholds should not gain achievements",
  );

  const migratedHighScore = normalizeProgress({ highScore: 15690 }, "2026-06-18");
  assert.ok(
    migratedHighScore.achievements.includes("score-10000"),
    "legacy high scores should migrate matching achievements without a later gameplay toast",
  );

  const progressed = applyProgressEvent(normalized, {
    scoreGain: 6000,
    currentRunScore: 6000,
    linesCleared: 4,
    boardClears: 1,
    comboEvents: 2,
    bestCombo: 10,
    boardClearStreak: 1,
    feverActivations: 1,
  }, "2026-06-18");
  assert.equal(progressed.profile.totalBoardClears, 1);
  assert.equal(progressed.profile.totalFeverActivations, 1);
  assert.ok(progressed.profile.achievements.includes("first-clear"));
  assert.ok(progressed.profile.achievements.includes("combo-master"));

  const candyStatus = getThemeUnlockStatus("candy", {
    ...progressed.profile,
    totalBoardClears: 5,
  });
  assert.equal(candyStatus.requirementMet, true, "theme progression should unlock by requirement");

  const run = { ...createRun(() => 0.2, 100), score: 5000, startedAt: Date.now() - 60000 };
  const finalized = finalizeRunProgress(progressed.profile, run);
  assert.equal(finalized.profile.totalGamesPlayed, progressed.profile.totalGamesPlayed + 1);
  assert.equal(finalized.run.finalized, true);
  const repeated = finalizeRunProgress(finalized.profile, finalized.run);
  assert.equal(repeated.profile.totalGamesPlayed, finalized.profile.totalGamesPlayed, "run finalization should be idempotent");
}

{
  const empty = createEmptyBoard();
  const crowded = fill(
    empty,
    Array.from({ length: BOARD_SIZE * BOARD_SIZE - 1 }, (_, index) => [
      Math.floor(index / BOARD_SIZE),
      index % BOARD_SIZE,
    ]),
  );
  const singleShape = PIECE_SHAPES.find((shape) => shape.id === "single");
  const bigShape = PIECE_SHAPES.find((shape) => shape.id === "box3");

  assert.equal(getBoardFullness(empty), 0, "empty board fullness should be zero");
  assert.ok(getBoardFullness(crowded) > 0.9, "crowded board fullness should be high");
  assert.ok(
    getAdaptiveShapeWeight(singleShape, { board: crowded, moves: 20 }) >
      getAdaptiveShapeWeight(singleShape, { board: empty, moves: 20 }),
    "crowded boards should favor small helpful pieces",
  );
  assert.equal(getGamePhase({ moves: 35, score: 8000, totalLines: 20 }), GAME_PHASES.warmup);
  assert.equal(getGamePhase({ moves: 36, score: 4000, totalLines: 12 }), GAME_PHASES.normal);
  assert.equal(getGamePhase({ moves: 70, score: 12000, totalLines: 40 }), GAME_PHASES.pressure);
  assert.equal(getGamePhase({ moves: 110, score: 26000, totalLines: 80 }), GAME_PHASES.highScore);

  const nearClear = fill(
    createEmptyBoard(),
    Array.from({ length: 6 }, (_, col) => [0, col]),
  );
  const duoH = PIECE_SHAPES.find((shape) => shape.id === "duo-h");
  assert.equal(
    getShapeClearOpportunity(nearClear, duoH),
    1,
    "generator should detect a shape that can complete a near-clear line",
  );
  assert.equal(
    getShapeBoardClearOpportunity(nearClear, duoH),
    true,
    "generator should recognize a piece that can create a complete board clear",
  );
  assert.equal(
    getBoardClearAssistLevel({ moves: 12, earlyAssistedBoardClearsUsed: 0 }),
    1,
    "early Board Clear assist should start strong",
  );
  assert.equal(
    getBoardClearAssistLevel({
      moves: 12,
      earlyAssistedBoardClearsUsed: EARLY_BOARD_CLEAR_ASSIST.maxUses,
    }),
    0.12,
    "early Board Clear assist should be sharply reduced after three assisted clears",
  );
  assert.equal(
    getBoardClearAssistLevel({ moves: 50, earlyAssistedBoardClearsUsed: 1 }),
    0.32,
    "Board Clear assist should remain subtle after the warm-up phase",
  );
  const assistedHand = [duoH, PIECE_SHAPES.find((shape) => shape.id === "box2"), PIECE_SHAPES.find((shape) => shape.id === "t4")];
  const earlyBoardClearScore = evaluateHandFun(nearClear, assistedHand, {
    moves: 12,
    earlyAssistedBoardClearsUsed: 0,
  }).score;
  const cappedBoardClearScore = evaluateHandFun(nearClear, assistedHand, {
    moves: 12,
    earlyAssistedBoardClearsUsed: EARLY_BOARD_CLEAR_ASSIST.maxUses,
  }).score;
  assert.ok(
    earlyBoardClearScore > cappedBoardClearScore + 3000,
    "director should stop heavily prioritizing perfect Board Clear hands after the cap",
  );
  assert.ok(
    getAdaptiveShapeWeight(duoH, {
      board: nearClear,
      moves: 12,
      earlyAssistedBoardClearsUsed: EARLY_BOARD_CLEAR_ASSIST.maxUses,
    }) >
      getAdaptiveShapeWeight(duoH, {
        board: createEmptyBoard(),
        moves: 12,
        earlyAssistedBoardClearsUsed: EARLY_BOARD_CLEAR_ASSIST.maxUses,
      }),
    "combo and line-clear assistance should stay active after Board Clear assistance is capped",
  );
  assert.equal(
    handHasBoardClearPath(nearClear, [
      { shapeId: "duo-h", cells: duoH.cells },
      { shapeId: "single", cells: singleShape.cells },
      { shapeId: "single", cells: singleShape.cells },
    ]),
    true,
    "Fun Director should detect Board Clear paths across a full hand",
  );
  assert.ok(
    getAdaptiveShapeWeight(duoH, { board: nearClear, moves: 5 }) >
      getAdaptiveShapeWeight(duoH, { board: createEmptyBoard(), moves: 5 }),
    "warm-up generation should favor useful clear opportunities",
  );
  assert.ok(
    getAdaptiveShapeWeight(bigShape, { board: empty, moves: 2 }) >
      getAdaptiveShapeWeight(bigShape, { board: crowded, moves: 20 }),
    "3x3 should be encouraged only while the board has reasonable open space",
  );

  const crowdedHand = generateHand(() => 0.5, 123, { board: crowded, moves: 20 });
  assert.equal(
    crowdedHand.every((item) => item.shapeId === "single"),
    true,
    "generated pieces should remain usable when only a single cell fits",
  );

  const random = seededRng(12345);
  const categoryCounts = {};
  let recentShapeIds = [];
  let consecutiveLongLineSets = 0;
  let maxConsecutiveLongLineSets = 0;
  let maxTinyPiecesPerSet = 0;
  for (let set = 0; set < 40; set += 1) {
    const hand = generateHand(random, set, {
      board: empty,
      moves: Math.min(set * 3, 100),
      score: set * 300,
      totalLines: set,
      boardClearPity: set % 17,
      recentShapeIds,
    });
    const categories = hand.map((item) => getPieceCategory(item.shapeId));
    categories.forEach((category) => {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    maxTinyPiecesPerSet = Math.max(
      maxTinyPiecesPerSet,
      categories.filter((category) => category === "single" || category === "duo").length,
    );
    consecutiveLongLineSets = categories.includes("longLine")
      ? consecutiveLongLineSets + 1
      : 0;
    maxConsecutiveLongLineSets = Math.max(
      maxConsecutiveLongLineSets,
      consecutiveLongLineSets,
    );
    recentShapeIds = [...recentShapeIds, ...hand.map((item) => item.shapeId)].slice(-12);
  }
  const lineRate =
    ((categoryCounts.shortLine || 0) + (categoryCounts.longLine || 0)) / 120;
  const tinyRate =
    ((categoryCounts.single || 0) + (categoryCounts.duo || 0)) / 120;
  const chunkyRate =
    ((categoryCounts.square2 || 0) +
      (categoryCounts.square3 || 0) +
      (categoryCounts.rectangle || 0) +
      (categoryCounts.corner || 0) +
      (categoryCounts.hook || 0) +
      (categoryCounts.tee || 0) +
      (categoryCounts.zig || 0)) / 120;
  assert.ok(lineRate < 0.35, "rolling bag should prevent line pieces from dominating");
  assert.ok(tinyRate <= 0.15, "tiny rescue pieces should not dominate clean-board generation");
  assert.ok(chunkyRate >= 0.55, "most clean-board pieces should be chunky and combo-friendly");
  assert.ok(maxTinyPiecesPerSet <= 1, "clean-board hands should not contain multiple tiny pieces");
  assert.ok((categoryCounts.square2 || 0) >= 8, "2x2 squares should appear regularly");
  assert.ok((categoryCounts.rectangle || 0) >= 8, "2x3 and 3x2 rectangles should appear regularly");
  assert.ok((categoryCounts.rectangle || 0) <= 48, "rectangles should stay varied rather than dominate");
  assert.ok((categoryCounts.square3 || 0) >= 2, "3x3 squares should appear occasionally");
  assert.ok(
    maxConsecutiveLongLineSets <= 2,
    "long lines should not appear in more than two consecutive sets",
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
  for (const shape of PIECE_SHAPES) {
    const testPiece = piece(shape.cells, shape.id);
    assert.equal(
      canPlacePiece(createEmptyBoard(), testPiece, 0, 0),
      true,
      `${shape.name} should fit on an empty board`,
    );
    const placed = placePiece(createEmptyBoard(), testPiece, 0, 0);
    assert.equal(
      placed.flat().filter(Boolean).length,
      shape.cells.length,
      `${shape.name} should place every cell`,
    );
  }
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
  const cleared = clearCompletedLines(placed, completed);
  assert.equal(isBoardEmpty(cleared.board), true, "clearing the only occupied row should create a board clear");
  const boardClearReward = getBoardClearReward(2, GAME_PHASES.pressure, 2);
  assert.equal(boardClearReward.score, 5250, "board clear score should include phase, combo, and streak bonuses");
  assert.ok(boardClearReward.coins > 0, "board clear should award coins");
  assert.ok(boardClearReward.xp > 0, "board clear should award XP");
}

{
  assert.equal(isBoardEmpty(createEmptyBoard()), true, "fresh board should be structurally empty");
  const occupied = placePiece(createEmptyBoard(), piece([[0, 0]]), 4, 4);
  assert.equal(isBoardEmpty(occupied), false, "occupied board should not count as empty");
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
    scoreGain: reward.score,
    coins: reward.coins,
    xp: 900,
    previousLines: 4,
    linesCleared: 6,
    comboEvent: 1,
  }, "2026-06-13");
  assert.ok(result.profile.totalCoins > profile.totalCoins, "profile coins should update");
  assert.ok(result.profile.level > profile.level, "level should increase with enough XP");
  assert.ok(result.profile.chestProgress > 0, "chest should gain progress");
  assert.equal(result.profile.totalLinesCleared, 6, "lifetime line stats should update");
  assert.equal(result.profile.lifetimeScore, reward.score, "lifetime score should use score deltas");
}

{
  const profile = createInitialProfile();
  const missionId = profile.dailyMissionIds[0];
  const mission = getMissionDefinition(missionId);
  const ready = {
    ...profile,
    dailyMissionProgress: {
      ...profile.dailyMissionProgress,
      [missionId]: { progress: mission.target, claimed: false },
    },
  };
  const claimed = claimMission(ready, missionId);
  assert.equal(claimed.claimed, true, "mission should be claimable");
  assert.ok(claimed.profile.totalCoins > ready.totalCoins, "mission should grant coins");
}

{
  const profile = { ...createInitialProfile("2026-06-13"), totalCoins: 5000 };
  const purchased = buySkin(profile, "neon");
  assert.equal(purchased.purchased, true, "skin purchase should work");
  assert.equal(selectSkin(purchased.profile, "neon").selected, true, "skin selection should work");
}

{
  const profile = { ...createInitialProfile("2026-06-13"), totalCoins: 500 };
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
  assert.equal(run.biggestCombo, 0, "restart should reset biggest combo");
  assert.equal(run.bestAtStart, 0, "run should remember the best score at its start");
  assert.equal(run.boardClearPity, 0, "restart should reset Board Clear pity");
  assert.equal(run.boardClears, 0, "restart should reset Board Clear streak");
  assert.equal(run.boardClearsThisRun, 0, "restart should reset run Board Clears");
  assert.equal(run.earlyAssistedBoardClearsUsed, 0, "restart should reset assisted Board Clear usage");
  assert.equal(run.feverActivations, 0, "restart should reset Fever activations");
  assert.equal(run.recentShapeIds.length, 3, "restart should seed rolling piece history");
  assert.equal(
    handHasBoardClearPath(run.board, run.pieces, { moves: 0 }),
    true,
    "opening hand should deliberately offer a realistic Board Clear path",
  );
  assert.equal(createRun(() => 0.2, 900).bestAtStart, 900, "new run should preserve starting best score");
}

console.log("Smoke tests passed");

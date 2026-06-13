export const BOARD_SIZE = 8;
export const CHEST_MAX = 8;

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

function weightedShape(rng = Math.random) {
  const total = PIECE_SHAPES.reduce((sum, shape) => sum + shape.weight, 0);
  let pick = rng() * total;
  for (const shape of PIECE_SHAPES) {
    pick -= shape.weight;
    if (pick <= 0) return shape;
  }
  return PIECE_SHAPES[0];
}

export function generatePiece(rng = Math.random, id = String(Date.now())) {
  const shape = weightedShape(rng);
  return {
    id,
    shapeId: shape.id,
    name: shape.name,
    cells: shape.cells.map((cell) => [...cell]),
    colorIndex: Math.floor(rng() * 4),
    placed: false,
  };
}

export function generateHand(rng = Math.random, seed = Date.now()) {
  return [0, 1, 2].map((slot) => generatePiece(rng, `p-${seed}-${slot}-${Math.floor(rng() * 100000)}`));
}

export function createRun(rng = Math.random) {
  return {
    board: createEmptyBoard(),
    pieces: generateHand(rng),
    score: 0,
    combo: 0,
    totalLines: 0,
    moves: 0,
    isOver: false,
    startedAt: Date.now(),
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
      colorIndex: (piece.colorIndex + index) % 4,
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

export function getPlacementReward(cellCount, lineCount, currentCombo) {
  const nextCombo = lineCount > 0 ? currentCombo + 1 : 0;
  const comboMultiplier = Math.max(1, nextCombo);
  const lineScore = lineCount * 120 * comboMultiplier;
  const multiLineBonus = Math.max(0, lineCount - 1) * 90;
  const score = cellCount * 10 + lineScore + multiLineBonus;
  const coins = Math.max(0, Math.floor(score / 90) + lineCount * 2 + (nextCombo >= 2 ? nextCombo * 3 : 0));
  const xp = Math.max(4, Math.floor(score / 7));

  return {
    score,
    coins,
    xp,
    nextCombo,
    comboMultiplier,
    lineCount,
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
    settings: { sound: true, voice: true, music: false, haptics: true },
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
    totalLines: Number(rawRun.totalLines) || 0,
    moves: Number(rawRun.moves) || 0,
    isOver: Boolean(rawRun.isOver),
    startedAt: Number(rawRun.startedAt) || Date.now(),
  };
}

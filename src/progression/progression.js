import { DEFAULT_SKIN_ID, SKINS, getSkin, isSkinId } from "../theme/skins.js";

export const BOARD_CLEAR_MILESTONES = [5, 15, 30, 50, 75, 100, 200];

export const MISSION_CATALOG = Object.freeze([
  { id: "score-500", metric: "score", mode: "sum", title: "Score 500 points", target: 500, reward: 50, tier: "Easy" },
  { id: "lines-5", metric: "lines", mode: "sum", title: "Clear 5 lines", target: 5, reward: 60, tier: "Easy" },
  { id: "games-2", metric: "games", mode: "sum", title: "Play 2 games", target: 2, reward: 70, tier: "Easy" },
  { id: "score-2000", metric: "score", mode: "sum", title: "Score 2,000 points", target: 2000, reward: 100, tier: "Medium" },
  { id: "lines-15", metric: "lines", mode: "sum", title: "Clear 15 lines", target: 15, reward: 120, tier: "Medium" },
  { id: "fever-2", metric: "fever", mode: "sum", title: "Trigger Rush Fever 2 times", target: 2, reward: 130, tier: "Medium" },
  { id: "combos-5", metric: "combos", mode: "sum", title: "Perform 5 combos", target: 5, reward: 110, tier: "Medium" },
  { id: "score-5000", metric: "score", mode: "sum", title: "Score 5,000 points", target: 5000, reward: 180, tier: "Hard" },
  { id: "board-clears-3", metric: "boardClears", mode: "sum", title: "Make 3 Board Clears", target: 3, reward: 220, tier: "Hard" },
  { id: "combo-10", metric: "bestCombo", mode: "max", title: "Reach combo x10", target: 10, reward: 200, tier: "Hard" },
  { id: "fever-5", metric: "fever", mode: "sum", title: "Trigger Rush Fever 5 times", target: 5, reward: 240, tier: "Hard" },
]);

export const ACHIEVEMENTS = Object.freeze([
  { id: "first-clear", title: "Clean Slate", description: "Make your first Board Clear", icon: "board", test: (p) => p.totalBoardClears >= 1 },
  { id: "clear-10", title: "Board Sweeper", description: "Make 10 Board Clears", icon: "board", test: (p) => p.totalBoardClears >= 10 },
  { id: "clear-50", title: "Clear Specialist", description: "Make 50 Board Clears", icon: "board", test: (p) => p.totalBoardClears >= 50 },
  { id: "combo-master", title: "Combo Master", description: "Reach combo x10", icon: "combo", test: (p) => p.bestCombo >= 10 },
  { id: "fever-starter", title: "Rush Starter", description: "Trigger Rush Fever", icon: "fever", test: (p) => p.totalFeverActivations >= 1 },
  { id: "fever-expert", title: "Rush Expert", description: "Trigger Rush Fever 25 times", icon: "fever", test: (p) => p.totalFeverActivations >= 25 },
  { id: "score-5000", title: "Five Grand", description: "Score 5,000 in one run", icon: "score", test: (p) => p.bestScore >= 5000 },
  { id: "score-10000", title: "High Voltage", description: "Score 10,000 in one run", icon: "score", test: (p) => p.bestScore >= 10000 },
  { id: "score-25000", title: "Rush Legend", description: "Score 25,000 in one run", icon: "score", test: (p) => p.bestScore >= 25000 },
  { id: "theme-collector", title: "Theme Collector", description: "Unlock 5 themes", icon: "theme", test: (p) => p.unlockedThemeIds.length >= 5 },
]);

const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
const MISSION_BY_ID = new Map(MISSION_CATALOG.map((mission) => [mission.id, mission]));

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, safeNumber(value, fallback));
}

function hashDate(date) {
  return [...String(date)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

function seededShuffle(items, seed) {
  const next = [...items];
  let value = seed >>> 0;
  for (let index = next.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const target = value % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function todayKey(date = new Date()) {
  const local = new Date(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyMissionIds(date = todayKey()) {
  const byTier = {
    Easy: MISSION_CATALOG.filter((mission) => mission.tier === "Easy"),
    Medium: MISSION_CATALOG.filter((mission) => mission.tier === "Medium"),
    Hard: MISSION_CATALOG.filter((mission) => mission.tier === "Hard"),
  };
  const seed = hashDate(date);
  return [
    seededShuffle(byTier.Easy, seed)[0],
    seededShuffle(byTier.Medium, seed ^ 0x9e3779b9)[0],
    seededShuffle(byTier.Hard, seed ^ 0x85ebca6b)[0],
  ].map((mission) => mission.id);
}

export function getMissionDefinition(id) {
  return MISSION_BY_ID.get(id);
}

export function createDailyMissionProgress(date = todayKey()) {
  const ids = getDailyMissionIds(date);
  return {
    ids,
    progress: Object.fromEntries(ids.map((id) => [id, { progress: 0, claimed: false, completedAt: null }])),
  };
}

function getLegacyMetricProgress(rawDaily, metric) {
  const missions = rawDaily?.missions || {};
  if (metric === "lines") return nonNegative(missions.clear20?.progress);
  if (metric === "score") return nonNegative(missions.score1000?.progress);
  if (metric === "combos" || metric === "bestCombo") return nonNegative(missions.combo3?.progress);
  return 0;
}

export function normalizeDailyMissions(raw, date = todayKey()) {
  const sourceDate = raw?.lastDailyMissionDate || raw?.daily?.date;
  const fresh = createDailyMissionProgress(date);
  if (sourceDate !== date) return fresh;

  const sourceIds = Array.isArray(raw?.dailyMissionIds)
    ? raw.dailyMissionIds.filter((id) => MISSION_BY_ID.has(id)).slice(0, 3)
    : [];
  const ids = sourceIds.length === 3 ? sourceIds : fresh.ids;
  const sourceProgress = raw?.dailyMissionProgress || raw?.daily?.missions || {};
  const progress = Object.fromEntries(ids.map((id) => {
    const mission = getMissionDefinition(id);
    const state = sourceProgress[id];
    const legacyProgress = getLegacyMetricProgress(raw?.daily, mission.metric);
    return [id, {
      progress: Math.min(mission.target, nonNegative(state?.progress, legacyProgress)),
      claimed: Boolean(state?.claimed),
      completedAt: typeof state?.completedAt === "string" ? state.completedAt : null,
    }];
  }));

  return { ids, progress };
}

export function createProgressDefaults(date = todayKey()) {
  const daily = createDailyMissionProgress(date);
  return {
    totalCoins: 120,
    lifetimeCoinsEarned: 120,
    lifetimeScore: 0,
    bestScore: 0,
    totalGamesPlayed: 0,
    totalLinesCleared: 0,
    totalBoardClears: 0,
    totalCombos: 0,
    bestCombo: 0,
    bestBoardClearStreak: 0,
    selectedThemeId: DEFAULT_SKIN_ID,
    unlockedThemeIds: [DEFAULT_SKIN_ID],
    dailyMissionIds: daily.ids,
    dailyMissionProgress: daily.progress,
    lastDailyMissionDate: date,
    missionsCompleted: 0,
    totalFeverActivations: 0,
    totalPlayTime: 0,
    lastPlayedAt: null,
    achievements: [],
  };
}

export function normalizeProgress(rawProfile, date = todayKey()) {
  const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const defaults = createProgressDefaults(date);
  const storedThemes = Array.isArray(raw.unlockedThemeIds)
    ? raw.unlockedThemeIds
    : Array.isArray(raw.ownedSkins)
      ? raw.ownedSkins
      : [];
  const unlockedThemeIds = [...new Set([
    DEFAULT_SKIN_ID,
    ...storedThemes.filter(isSkinId),
  ])];
  const requestedTheme = raw.selectedThemeId || raw.selectedSkin;
  const selectedThemeId =
    isSkinId(requestedTheme) && unlockedThemeIds.includes(requestedTheme)
      ? requestedTheme
      : DEFAULT_SKIN_ID;
  const daily = normalizeDailyMissions(raw, date);
  const normalized = {
    ...defaults,
    totalCoins: nonNegative(raw.totalCoins, nonNegative(raw.coins, defaults.totalCoins)),
    lifetimeCoinsEarned: nonNegative(
      raw.lifetimeCoinsEarned,
      nonNegative(raw.totalCoins, nonNegative(raw.coins, defaults.lifetimeCoinsEarned)),
    ),
    lifetimeScore: nonNegative(raw.lifetimeScore),
    bestScore: nonNegative(raw.bestScore, nonNegative(raw.highScore)),
    totalGamesPlayed: nonNegative(raw.totalGamesPlayed),
    totalLinesCleared: nonNegative(raw.totalLinesCleared),
    totalBoardClears: nonNegative(raw.totalBoardClears),
    totalCombos: nonNegative(raw.totalCombos),
    bestCombo: nonNegative(raw.bestCombo),
    bestBoardClearStreak: nonNegative(raw.bestBoardClearStreak),
    selectedThemeId,
    unlockedThemeIds,
    dailyMissionIds: daily.ids,
    dailyMissionProgress: daily.progress,
    lastDailyMissionDate: date,
    missionsCompleted: nonNegative(raw.missionsCompleted),
    totalFeverActivations: nonNegative(raw.totalFeverActivations),
    totalPlayTime: nonNegative(raw.totalPlayTime),
    lastPlayedAt: typeof raw.lastPlayedAt === "string" ? raw.lastPlayedAt : null,
    achievements: Array.isArray(raw.achievements)
      ? [...new Set(raw.achievements.filter((id) => ACHIEVEMENT_IDS.has(id)))]
      : [],
  };
  const migratedAchievements = ACHIEVEMENTS
    .filter((achievement) => achievement.test(normalized))
    .map((achievement) => achievement.id);

  return {
    ...normalized,
    achievements: [...new Set([...normalized.achievements, ...migratedAchievements])],
  };
}

function missionEventValue(mission, event) {
  const values = {
    score: nonNegative(event.scoreGain),
    lines: nonNegative(event.linesCleared),
    games: nonNegative(event.gamesPlayed),
    boardClears: nonNegative(event.boardClears),
    combos: nonNegative(event.comboEvents),
    bestCombo: nonNegative(event.bestCombo),
    fever: nonNegative(event.feverActivations),
  };
  return values[mission.metric] || 0;
}

export function updateDailyMissions(profile, event, date = todayKey()) {
  const normalized = { ...profile, ...normalizeProgress(profile, date) };
  const progress = { ...normalized.dailyMissionProgress };
  const newlyCompleted = [];

  normalized.dailyMissionIds.forEach((id) => {
    const mission = getMissionDefinition(id);
    const current = progress[id] || { progress: 0, claimed: false, completedAt: null };
    const value = missionEventValue(mission, event);
    const nextValue = mission.mode === "max"
      ? Math.max(current.progress, value)
      : current.progress + value;
    const bounded = Math.min(mission.target, nextValue);
    const completedNow = current.progress < mission.target && bounded >= mission.target;
    progress[id] = {
      ...current,
      progress: bounded,
      completedAt: completedNow ? new Date().toISOString() : current.completedAt,
    };
    if (completedNow) newlyCompleted.push(id);
  });

  return {
    profile: {
      ...normalized,
      dailyMissionProgress: progress,
      lastDailyMissionDate: date,
    },
    newlyCompleted,
  };
}

export function evaluateAchievements(profile) {
  const completed = new Set(profile.achievements || []);
  const unlocked = ACHIEVEMENTS.filter((achievement) => !completed.has(achievement.id) && achievement.test(profile));
  if (!unlocked.length) return { profile, unlocked: [] };
  return {
    profile: {
      ...profile,
      achievements: [...completed, ...unlocked.map((achievement) => achievement.id)],
    },
    unlocked,
  };
}

export function applyProgressEvent(profile, event, date = todayKey()) {
  let nextProfile = { ...profile, ...normalizeProgress(profile, date) };
  const coinsEarned = nonNegative(event.coinsEarned);
  const scoreGain = nonNegative(event.scoreGain);
  const comboEvents = nonNegative(event.comboEvents);
  nextProfile = {
    ...nextProfile,
    totalCoins: nextProfile.totalCoins + coinsEarned,
    lifetimeCoinsEarned: nextProfile.lifetimeCoinsEarned + coinsEarned,
    lifetimeScore: nextProfile.lifetimeScore + scoreGain,
    bestScore: Math.max(nextProfile.bestScore, nonNegative(event.currentRunScore)),
    totalGamesPlayed: nextProfile.totalGamesPlayed + nonNegative(event.gamesPlayed),
    totalLinesCleared: nextProfile.totalLinesCleared + nonNegative(event.linesCleared),
    totalBoardClears: nextProfile.totalBoardClears + nonNegative(event.boardClears),
    totalCombos: nextProfile.totalCombos + comboEvents,
    bestCombo: Math.max(nextProfile.bestCombo, nonNegative(event.bestCombo)),
    bestBoardClearStreak: Math.max(
      nextProfile.bestBoardClearStreak,
      nonNegative(event.boardClearStreak),
    ),
    totalFeverActivations:
      nextProfile.totalFeverActivations + nonNegative(event.feverActivations),
    totalPlayTime: nextProfile.totalPlayTime + nonNegative(event.playTime),
    lastPlayedAt: new Date().toISOString(),
  };
  const missions = updateDailyMissions(nextProfile, event, date);
  const achievements = evaluateAchievements(missions.profile);
  return {
    profile: achievements.profile,
    newlyCompletedMissions: missions.newlyCompleted,
    unlockedAchievements: achievements.unlocked,
  };
}

export function claimDailyMission(profile, missionId, date = todayKey()) {
  const normalized = { ...profile, ...normalizeProgress(profile, date) };
  const mission = getMissionDefinition(missionId);
  const state = normalized.dailyMissionProgress[missionId];
  if (!mission || !state || state.claimed || state.progress < mission.target) {
    return { profile: normalized, claimed: false };
  }

  const progress = {
    ...normalized.dailyMissionProgress,
    [missionId]: { ...state, claimed: true },
  };
  const rewarded = {
    ...normalized,
    totalCoins: normalized.totalCoins + mission.reward,
    lifetimeCoinsEarned: normalized.lifetimeCoinsEarned + mission.reward,
    missionsCompleted: normalized.missionsCompleted + 1,
    dailyMissionProgress: progress,
  };
  const achievements = evaluateAchievements(rewarded);
  return {
    profile: achievements.profile,
    claimed: true,
    reward: mission.reward,
    unlockedAchievements: achievements.unlocked,
  };
}

export function getNextBoardClearMilestone(totalBoardClears) {
  const total = nonNegative(totalBoardClears);
  return BOARD_CLEAR_MILESTONES.find((milestone) => milestone > total) || BOARD_CLEAR_MILESTONES.at(-1);
}

function getRequirementProgress(requirement, profile) {
  const values = {
    default: 1,
    lifetimeBoardClears: profile.totalBoardClears,
    bestBoardClearStreak: profile.bestBoardClearStreak,
    missionsCompleted: profile.missionsCompleted,
    specialAchievement: profile.achievements?.includes(requirement.achievementId) ? 1 : 0,
  };
  return requirement.type === "default" ? 1 : nonNegative(values[requirement.type]);
}

export function getThemeUnlockStatus(themeOrId, profile) {
  const theme = typeof themeOrId === "string" ? getSkin(themeOrId) : themeOrId;
  const unlocked = profile.unlockedThemeIds.includes(theme.id);
  const requirement = theme.unlockRequirement || { type: "default", target: 0 };
  const progress = getRequirementProgress(requirement, profile);
  const target = nonNegative(requirement.target, 1);
  const requirementMet = requirement.type === "default" || progress >= target;
  return {
    unlocked,
    requirementMet,
    progress,
    target,
    coinPrice: nonNegative(theme.coinPrice),
    canBuy: !unlocked && profile.totalCoins >= nonNegative(theme.coinPrice),
  };
}

export function getThemeRequirementLabel(themeOrId, profile) {
  const theme = typeof themeOrId === "string" ? getSkin(themeOrId) : themeOrId;
  const status = getThemeUnlockStatus(theme, profile);
  const requirement = theme.unlockRequirement;
  if (status.unlocked) return "Unlocked";
  if (requirement?.type === "lifetimeBoardClears") {
    return `${Math.min(status.progress, status.target)} / ${status.target} Board Clears`;
  }
  if (requirement?.type === "bestBoardClearStreak") {
    return `Board Clear streak ${Math.min(status.progress, status.target)} / ${status.target}`;
  }
  if (requirement?.type === "missionsCompleted") {
    return `${Math.min(status.progress, status.target)} / ${status.target} missions claimed`;
  }
  if (requirement?.type === "specialAchievement") {
    return status.requirementMet ? "Achievement complete" : "Special achievement required";
  }
  return "Ready";
}

export function unlockTheme(profile, themeId) {
  const theme = SKINS.find((item) => item.id === themeId);
  if (!theme) return { profile, unlocked: false, reason: "missing" };
  const normalized = { ...profile, ...normalizeProgress(profile) };
  const status = getThemeUnlockStatus(theme, normalized);
  if (status.unlocked) return { profile: normalized, unlocked: false, reason: "owned" };
  const byRequirement = status.requirementMet;
  if (!byRequirement && !status.canBuy) {
    return { profile: normalized, unlocked: false, reason: "locked" };
  }
  const cost = byRequirement ? 0 : status.coinPrice;
  let nextProfile = {
    ...normalized,
    totalCoins: normalized.totalCoins - cost,
    unlockedThemeIds: [...normalized.unlockedThemeIds, theme.id],
    selectedThemeId: theme.id,
  };
  const achievements = evaluateAchievements(nextProfile);
  nextProfile = achievements.profile;
  return {
    profile: nextProfile,
    unlocked: true,
    cost,
    method: byRequirement ? "progress" : "coins",
    unlockedAchievements: achievements.unlocked,
  };
}

export function equipTheme(profile, themeId) {
  const normalized = { ...profile, ...normalizeProgress(profile) };
  if (!normalized.unlockedThemeIds.includes(themeId) || !isSkinId(themeId)) {
    return { profile: normalized, selected: false };
  }
  return {
    profile: { ...normalized, selectedThemeId: themeId },
    selected: true,
  };
}

export function getEligibleLockedThemes(profile) {
  return SKINS.filter((theme) => {
    const status = getThemeUnlockStatus(theme, profile);
    return !status.unlocked && status.requirementMet;
  });
}

export function finalizeRunProgress(profile, run, endedAt = Date.now()) {
  if (run.finalized) return { profile, run, summary: run.resultSummary || null };
  const playTime = Math.max(0, Math.round((endedAt - nonNegative(run.startedAt, endedAt)) / 1000));
  const newBest = run.score > nonNegative(run.bestAtStart);
  const newBestBonus = newBest ? Math.min(150, Math.max(50, 50 + Math.floor(run.score / 1000) * 10)) : 0;
  const progress = applyProgressEvent(profile, {
    coinsEarned: newBestBonus,
    gamesPlayed: 1,
    playTime,
    currentRunScore: run.score,
  });
  const beforeProfile = {
    ...progress.profile,
    totalBoardClears: nonNegative(run.totalBoardClearsAtStart),
    bestBoardClearStreak: nonNegative(run.bestBoardClearStreakAtStart),
  };
  const eligibleAfter = getEligibleLockedThemes(progress.profile).filter((theme) => {
    const requirement = theme.unlockRequirement || { type: "default", target: 0 };
    return getRequirementProgress(requirement, beforeProfile) < nonNegative(requirement.target, 1);
  });
  const summary = {
    newBest,
    newBestBonus,
    playTime,
    newlyCompletedMissions: [...new Set([
      ...(run.progressEvents?.missions || []),
      ...progress.newlyCompletedMissions,
    ])],
    unlockedAchievements: [...new Set([
      ...(run.progressEvents?.achievements || []),
      ...progress.unlockedAchievements.map((achievement) => achievement.id),
    ])],
    newlyEligibleThemes: eligibleAfter.map((theme) => theme.id),
    missionProgressGained: Object.fromEntries(
      progress.profile.dailyMissionIds.map((id) => [
        id,
        Math.max(
          0,
          nonNegative(progress.profile.dailyMissionProgress[id]?.progress) -
            nonNegative(run.missionProgressAtStart?.[id]),
        ),
      ]),
    ),
  };
  return {
    profile: progress.profile,
    run: {
      ...run,
      finalized: true,
      coinsEarned: nonNegative(run.coinsEarned) + newBestBonus,
      resultSummary: summary,
    },
    summary,
  };
}

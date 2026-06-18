export function createResultShareText(run, profile, themeName) {
  const lines = [
    `I scored ${Math.max(0, Number(run?.score) || 0).toLocaleString()} in Block Rush!`,
    `Board Clears: ${Math.max(0, Number(run?.boardClears) || 0)}`,
    `Best Streak: x${Math.max(0, Number(run?.bestBoardClearStreak) || 0)}`,
    `Biggest Combo: x${Math.max(0, Number(run?.biggestCombo) || 0)}`,
    `Theme: ${themeName || "Classic Blue"}`,
  ];

  if ((run?.score || 0) > (run?.bestAtStart || profile?.bestScore || 0)) {
    lines.splice(1, 0, "New Best!");
  }

  return `${lines.join("\n")}\nCan you beat me?`;
}

export async function copyResultText(text, clipboard = globalThis.navigator?.clipboard) {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

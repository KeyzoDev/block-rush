import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bomb,
  Check,
  Coins,
  Gift,
  Hammer,
  Home,
  Lock,
  Mic2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Settings,
  ShoppingBag,
  Shuffle,
  Smartphone,
  Star,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  BOARD_SIZE,
  BONUS_STAGE,
  CHEST_MAX,
  MISSION_DEFS,
  POWERUPS,
  SKINS,
  STORAGE_KEYS,
  advanceBonusStage,
  applyGameProgress,
  bonusizePieces,
  buyPowerup,
  buySkin,
  canAnyPieceFit,
  canPlacePiece,
  claimMission,
  clearArea,
  clearCompletedLines,
  comboLabel,
  createInitialProfile,
  createRun,
  findCompletedLines,
  generateHand,
  getPieceBounds,
  getPieceColorIndex,
  getPlacementReward,
  getSkin,
  levelThreshold,
  normalizeCells,
  normalizeProfile,
  openChest,
  placePiece,
  removeCell,
  reviveRunFromStorage,
  selectSkin,
  shouldStartBonusStage,
  spendPowerup,
} from "./game/gameLogic.js";

let audioContext;
let musicNodes;

function readJson(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked in private browsing; the game still runs in memory.
  }
}

function getPointCell(boardElement, piece, point) {
  if (!boardElement || !piece) return null;
  const rect = boardElement.getBoundingClientRect();
  const cell = rect.width / BOARD_SIZE;
  const bounds = getPieceBounds(piece);
  const row = Math.floor((point.y - rect.top) / cell - bounds.height / 2);
  const col = Math.floor((point.x - rect.left) / cell - bounds.width / 2);
  return { row, col };
}

function playSound(kind, enabled) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext ||= new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume();
    const now = audioContext.currentTime;
    const map = {
      place: [[430, 560], 0.045, "triangle", 0.07],
      clear: [[620, 850, 1120], 0.11, "sine", 0.08],
      bigClear: [[240, 520, 920, 1380], 0.2, "triangle", 0.09],
      combo: [[520, 760, 1040, 1480], 0.18, "sine", 0.1],
      bad: [140, 0.06],
      reward: [[640, 820, 1040], 0.16, "sine", 0.08],
    };
    const config = map[kind] || map.place;
    if (kind === "bad") {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(config[0], now);
      osc.frequency.exponentialRampToValueAtTime(80, now + config[1]);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + config[1]);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + config[1] + 0.02);
      return;
    }

    const [notes, length, type, volume] = config;
    notes.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * Math.min(0.045, length / notes.length);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.18, start + length);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + length);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + length + 0.03);
    });
  } catch {
    // Audio feedback is optional.
  }
}

function setMusic(enabled) {
  if (typeof window === "undefined") return;
  try {
    if (!enabled) {
      if (musicNodes) {
        musicNodes.gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
        window.setTimeout(() => {
          musicNodes?.oscA.stop();
          musicNodes?.oscB.stop();
          musicNodes = null;
        }, 220);
      }
      return;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || musicNodes) return;
    audioContext ||= new AudioCtor();
    if (audioContext.state === "suspended") audioContext.resume();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscA = audioContext.createOscillator();
    const oscB = audioContext.createOscillator();
    oscA.type = "sine";
    oscB.type = "triangle";
    oscA.frequency.setValueAtTime(146.83, now);
    oscB.frequency.setValueAtTime(220, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.3);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(audioContext.destination);
    oscA.start();
    oscB.start();
    musicNodes = { gain, oscA, oscB };
  } catch {
    musicNodes = null;
  }
}

function speakPraise(text, enabled) {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
    utterance.rate = 1.02;
    utterance.pitch = 1.28;
    utterance.volume = 0.42;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Voice feedback is optional.
  }
}

function haptic(enabled, pattern = 18) {
  if (enabled && navigator.vibrate) navigator.vibrate(pattern);
}

function praiseLabel(lineCount, combo) {
  if (combo >= 5) return "UNBELIEVABLE";
  if (lineCount >= 4) return "AMAZING";
  if (combo >= 4 || lineCount >= 3) return "EXCELLENT";
  if (combo >= 3 || lineCount >= 2) return "AWESOME";
  if (combo >= 2) return "GREAT";
  if (lineCount >= 1) return "GOOD";
  return "";
}

function syncPiecesWithBonus(pieces, bonus) {
  if (bonus?.active) return bonusizePieces(pieces);
  return pieces.map((piece) =>
    piece?.bonus && !piece.placed
      ? {
          ...piece,
          solid: false,
          bonus: false,
        }
      : piece,
  );
}

function ProgressBar({ value, max, label }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-wrap" aria-label={label}>
      <div className="progress-copy">
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PiecePreview({ piece, skinId, compact = false }) {
  if (!piece || piece.placed) return <div className="empty-piece">Ready</div>;
  const bounds = getPieceBounds(piece);
  const cells = normalizeCells(piece.cells);
  const skin = getSkin(skinId);
  const filled = new Map(cells.map(([row, col], index) => [`${row}-${col}`, index]));
  const grid = [];

  for (let row = 0; row < bounds.height; row += 1) {
    for (let col = 0; col < bounds.width; col += 1) {
      const index = filled.get(`${row}-${col}`);
      grid.push(
        <span
          key={`${row}-${col}`}
          className={`piece-cell ${index !== undefined ? "filled" : ""}`}
          style={
            index !== undefined
              ? { background: skin.swatches[getPieceColorIndex(piece, index) % skin.swatches.length] }
              : undefined
          }
        />,
      );
    }
  }

  return (
    <div
      className={`piece-grid ${compact ? "compact" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${bounds.width}, var(--piece-cell))`,
        gridTemplateRows: `repeat(${bounds.height}, var(--piece-cell))`,
      }}
      aria-label={piece.name}
    >
      {grid}
    </div>
  );
}

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="stat-pill">
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled = false, tone = "plain" }) {
  return (
    <button className={`icon-button ${tone}`} type="button" onClick={onClick} disabled={disabled} title={label}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Board({ board, boardRef, skinId, hover, clearMarks, activePower, onCellAction }) {
  const selectedSkin = getSkin(skinId);
  const previewCells = new Set();
  if (hover?.piece) {
    hover.piece.cells.forEach(([pieceRow, pieceCol]) => {
      previewCells.add(`${hover.row + pieceRow}-${hover.col + pieceCol}`);
    });
  }
  const clearCells = new Map(
    clearMarks.map((mark) => {
      const row = Array.isArray(mark) ? mark[0] : mark.row;
      const col = Array.isArray(mark) ? mark[1] : mark.col;
      const delay = Array.isArray(mark) ? 0 : mark.delay;
      return [`${row}-${col}`, delay || 0];
    }),
  );

  return (
    <div
      ref={boardRef}
      className={`board ${activePower ? "targeting" : ""}`}
      style={{ "--board-bg": selectedSkin.board }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const preview = previewCells.has(key);
          const clearDelay = clearCells.get(key);
          const clearing = clearDelay !== undefined;
          const cellSkin = cell ? getSkin(cell.skin) : selectedSkin;
          const color = cell ? cellSkin.swatches[cell.colorIndex % cellSkin.swatches.length] : undefined;
          return (
            <button
              type="button"
              className={[
                "board-cell",
                cell ? "filled" : "",
                preview ? "preview" : "",
                preview && hover?.valid ? "valid" : "",
                preview && !hover?.valid ? "invalid" : "",
                clearing ? "clearing" : "",
                activePower ? "tool-target" : "",
              ].join(" ")}
              key={key}
              style={{
                ...(color ? { background: color } : {}),
                ...(clearing ? { "--clear-delay": `${clearDelay}ms` } : {}),
              }}
              onPointerDown={(event) => {
                if (!activePower) return;
                event.preventDefault();
                onCellAction(rowIndex, colIndex);
              }}
              aria-label={`Cell ${rowIndex + 1}, ${colIndex + 1}`}
            />
          );
        }),
      )}
    </div>
  );
}

function GameScreen({
  run,
  profile,
  boardRef,
  hover,
  clearMarks,
  particles,
  lastReward,
  praise,
  drag,
  activePower,
  onBeginDrag,
  onSelectPowerup,
  onCellAction,
  onPause,
  onOpenSettings,
}) {
  const skin = getSkin(profile.selectedSkin);
  return (
    <main className="game-screen">
      <header className="top-bar">
        <div className="best-chip">
          <Trophy size={14} aria-hidden="true" />
          <span>{profile.highScore.toLocaleString()}</span>
        </div>
        <div className="score-block">
          <span>Score</span>
          <h1>{run.score.toLocaleString()}</h1>
        </div>
        <div className="top-actions">
          <button className="round-button" type="button" onClick={onPause} title="Pause">
            <Pause size={18} aria-hidden="true" />
          </button>
          <button className="round-button" type="button" onClick={onOpenSettings} title="Settings">
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="board-wrap">
        {run.combo > 0 && (
          <div className="combo-meter" aria-live="polite">
            <span>Combo</span>
            <strong>x{run.combo}</strong>
          </div>
        )}
        {run.bonus?.active && (
          <div className="rush-meter" aria-live="polite">
            <Zap size={15} aria-hidden="true" />
            <span>Rush x{BONUS_STAGE.scoreMultiplier}</span>
            <strong>{run.bonus.movesLeft}</strong>
          </div>
        )}
        <Board
          board={run.board}
          boardRef={boardRef}
          skinId={profile.selectedSkin}
          hover={hover}
          clearMarks={clearMarks}
          activePower={activePower}
          onCellAction={onCellAction}
        />
        <div className="particles" aria-hidden="true">
          {particles.map((particle) => (
            <i
              key={particle.id}
              className="particle"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                "--dx": `${particle.dx}px`,
                "--dy": `${particle.dy}px`,
                background: skin.swatches[particle.color],
              }}
            />
          ))}
        </div>
        {lastReward && (
          <div className="reward-burst" aria-live="polite">
            <strong>+{lastReward.score}</strong>
            <span>
              {lastReward.lines > 0 ? `${lastReward.lines} line${lastReward.lines > 1 ? "s" : ""}` : "Nice move"}
            </span>
          </div>
        )}
      </div>

      <section className="piece-tray" aria-label="Available pieces">
        {run.pieces.map((piece) => (
          <button
            className={`piece-slot ${piece.placed ? "placed" : ""}`}
            type="button"
            key={piece.id}
            onPointerDown={(event) => onBeginDrag(event, piece)}
            disabled={piece.placed || run.isOver}
            aria-label={piece.placed ? "Placed piece" : `Drag ${piece.name}`}
          >
            <PiecePreview piece={piece} skinId={profile.selectedSkin} />
          </button>
        ))}
      </section>

      <section className="power-row compact-tools" aria-label="Power-ups">
        <button
          className={`power-button ${activePower === "hammer" ? "active" : ""}`}
          type="button"
          onClick={() => onSelectPowerup("hammer")}
        >
          <Hammer size={18} aria-hidden="true" />
          <span>Hammer</span>
          <strong>{profile.powerups.hammer || 0}</strong>
        </button>
        <button className="power-button" type="button" onClick={() => onSelectPowerup("shuffle")}>
          <Shuffle size={18} aria-hidden="true" />
          <span>Shuffle</span>
          <strong>{profile.powerups.shuffle || 0}</strong>
        </button>
        <button
          className={`power-button ${activePower === "bomb" ? "active" : ""}`}
          type="button"
          onClick={() => onSelectPowerup("bomb")}
        >
          <Bomb size={18} aria-hidden="true" />
          <span>Bomb</span>
          <strong>{profile.powerups.bomb || 0}</strong>
        </button>
      </section>

      {activePower && (
        <div className="tool-cue" aria-live="polite">
          {activePower === "hammer" ? "Tap a filled cell" : "Tap the blast center"}
        </div>
      )}

      {drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
          <PiecePreview piece={drag.piece} skinId={profile.selectedSkin} compact />
        </div>
      )}
      {praise && <PraiseFlash label={praise} />}
    </main>
  );
}

function MainMenu({ run, profile, onPlay, onNewGame, onShop, onMissions, onSettings }) {
  const hasSavedRun = run.moves > 0 && !run.isOver;
  return (
    <main className="menu-screen">
      <section className="brand-panel">
        <span className="eyebrow">8x8 puzzle</span>
        <h1>Block Rush</h1>
        <p>Place pieces, clear lines, chain combos, and unlock bright block styles.</p>
      </section>

      <section className="menu-stats">
        <StatPill icon={Trophy} label="Best" value={profile.highScore.toLocaleString()} />
        <StatPill icon={Coins} label="Coins" value={profile.coins.toLocaleString()} />
        <StatPill icon={Star} label="Level" value={profile.level} />
      </section>

      <section className="primary-actions">
        <button className="primary-button" type="button" onClick={hasSavedRun ? onPlay : onNewGame}>
          <Play size={20} aria-hidden="true" />
          <span>{hasSavedRun ? "Continue" : "Play"}</span>
        </button>
        <button className="secondary-button" type="button" onClick={onNewGame}>
          <RotateCcw size={18} aria-hidden="true" />
          <span>New Game</span>
        </button>
      </section>

      <nav className="menu-grid" aria-label="Main menu">
        <IconButton icon={ShoppingBag} label="Shop" onClick={onShop} />
        <IconButton icon={Target} label="Missions" onClick={onMissions} />
        <IconButton icon={Gift} label="Chest" onClick={onMissions} />
        <IconButton icon={Settings} label="Settings" onClick={onSettings} />
      </nav>
    </main>
  );
}

function ShopScreen({ profile, onBack, onBuySkin, onSelectSkin, onBuyPowerup }) {
  return (
    <main className="panel-screen">
      <ScreenHeader title="Shop" onBack={onBack} meta={`${profile.coins.toLocaleString()} coins`} />
      <section className="shop-section">
        <h2>Block themes</h2>
        <div className="skin-list">
          {SKINS.map((skin) => {
            const owned = profile.ownedSkins.includes(skin.id);
            const selected = profile.selectedSkin === skin.id;
            return (
              <article className={`skin-card ${selected ? "selected" : ""}`} key={skin.id}>
                <div className="skin-preview" style={{ background: skin.board }}>
                  {skin.swatches.map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </div>
                <div>
                  <h3>{skin.name}</h3>
                  <p>{owned ? "Owned" : `${skin.price} coins`}</p>
                </div>
                {selected ? (
                  <button className="mini-button done" type="button" disabled>
                    <Check size={16} aria-hidden="true" />
                    <span>Active</span>
                  </button>
                ) : owned ? (
                  <button className="mini-button" type="button" onClick={() => onSelectSkin(skin.id)}>
                    <Check size={16} aria-hidden="true" />
                    <span>Select</span>
                  </button>
                ) : (
                  <button
                    className="mini-button"
                    type="button"
                    onClick={() => onBuySkin(skin.id)}
                    disabled={profile.coins < skin.price}
                  >
                    <Lock size={16} aria-hidden="true" />
                    <span>Buy</span>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="shop-section">
        <h2>Power-ups</h2>
        <div className="power-shop">
          {Object.values(POWERUPS).map((powerup) => (
            <article className="power-card" key={powerup.id}>
              <div className="power-icon">
                {powerup.id === "hammer" && <Hammer size={22} aria-hidden="true" />}
                {powerup.id === "shuffle" && <Shuffle size={22} aria-hidden="true" />}
                {powerup.id === "bomb" && <Bomb size={22} aria-hidden="true" />}
              </div>
              <div>
                <h3>{powerup.name}</h3>
                <p>{profile.powerups[powerup.id] || 0} owned</p>
              </div>
              <button
                className="mini-button"
                type="button"
                onClick={() => onBuyPowerup(powerup.id)}
                disabled={profile.coins < powerup.cost}
              >
                <Coins size={16} aria-hidden="true" />
                <span>{powerup.cost}</span>
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MissionsScreen({ profile, onBack, onClaim, onOpenChest }) {
  return (
    <main className="panel-screen">
      <ScreenHeader title="Missions" onBack={onBack} meta="Daily" />
      <section className="mission-list">
        {MISSION_DEFS.map((mission) => {
          const state = profile.daily.missions[mission.id] || { progress: 0, claimed: false };
          const ready = state.progress >= mission.target;
          return (
            <article className="mission-card" key={mission.id}>
              <div className="mission-icon">
                <Target size={20} aria-hidden="true" />
              </div>
              <div className="mission-body">
                <h2>{mission.title}</h2>
                <ProgressBar value={Math.min(state.progress, mission.target)} max={mission.target} label="Progress" />
              </div>
              <button
                className="mini-button"
                type="button"
                disabled={!ready || state.claimed}
                onClick={() => onClaim(mission.id)}
              >
                <Coins size={16} aria-hidden="true" />
                <span>{state.claimed ? "Done" : mission.reward}</span>
              </button>
            </article>
          );
        })}
      </section>

      <section className="chest-panel">
        <Gift size={28} aria-hidden="true" />
        <div>
          <h2>Reward Chest</h2>
          <ProgressBar value={profile.chestProgress} max={CHEST_MAX} label="Chest" />
        </div>
        <button className="primary-button small" type="button" disabled={profile.chestProgress < CHEST_MAX} onClick={onOpenChest}>
          <Gift size={18} aria-hidden="true" />
          <span>Open</span>
        </button>
      </section>
    </main>
  );
}

function SettingsScreen({ profile, onBack, onToggleSetting, onResetProgress, confirmReset, onConfirmReset }) {
  return (
    <main className="panel-screen">
      <ScreenHeader title="Settings" onBack={onBack} meta="Local save" />
      <section className="settings-list">
        <button className="setting-row" type="button" onClick={() => onToggleSetting("sound")}>
          {profile.settings.sound ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
          <span>Sound effects</span>
          <strong>{profile.settings.sound ? "On" : "Off"}</strong>
        </button>
        <button className="setting-row" type="button" onClick={() => onToggleSetting("voice")}>
          <Mic2 size={20} aria-hidden="true" />
          <span>Voice</span>
          <strong>{profile.settings.voice ? "On" : "Off"}</strong>
        </button>
        <button className="setting-row" type="button" onClick={() => onToggleSetting("music")}>
          <Music size={20} aria-hidden="true" />
          <span>Music</span>
          <strong>{profile.settings.music ? "On" : "Off"}</strong>
        </button>
        <button className="setting-row" type="button" onClick={() => onToggleSetting("haptics")}>
          <Smartphone size={20} aria-hidden="true" />
          <span>Haptics</span>
          <strong>{profile.settings.haptics ? "On" : "Off"}</strong>
        </button>
        <button className={`setting-row danger ${confirmReset ? "confirm" : ""}`} type="button" onClick={confirmReset ? onConfirmReset : onResetProgress}>
          <RotateCcw size={20} aria-hidden="true" />
          <span>{confirmReset ? "Confirm reset" : "Reset progress"}</span>
          <strong>{confirmReset ? "Tap" : ""}</strong>
        </button>
      </section>
    </main>
  );
}

function ScreenHeader({ title, meta, onBack }) {
  return (
    <header className="screen-header">
      <button className="round-button" type="button" onClick={onBack} title="Back">
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div>
        <h1>{title}</h1>
        {meta && <span>{meta}</span>}
      </div>
    </header>
  );
}

function GameOverScreen({ run, profile, onRestart, onMenu, onShop }) {
  const bestBeat = run.score >= profile.highScore && run.score > 0;
  return (
    <main className="panel-screen game-over">
      <section className="game-over-hero">
        <div className="trophy-ring">
          <Trophy size={38} aria-hidden="true" />
        </div>
        <span className="eyebrow">Game Over</span>
        <h1>{run.score.toLocaleString()}</h1>
        <p>{bestBeat ? "New best score" : `${run.totalLines} lines cleared`}</p>
      </section>
      <section className="menu-stats">
        <StatPill icon={Trophy} label="Best" value={profile.highScore.toLocaleString()} />
        <StatPill icon={Coins} label="Earned" value={`+${run.coinsEarned || 0}`} />
        <StatPill icon={Star} label="XP" value={`+${run.xpEarned || 0}`} />
      </section>
      <section className="primary-actions">
        <button className="primary-button" type="button" onClick={onRestart}>
          <RotateCcw size={20} aria-hidden="true" />
          <span>Restart</span>
        </button>
        <button className="secondary-button" type="button" onClick={onShop}>
          <ShoppingBag size={18} aria-hidden="true" />
          <span>Shop</span>
        </button>
        <button className="secondary-button" type="button" onClick={onMenu}>
          <Home size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </section>
    </main>
  );
}

function PauseModal({ profile, onResume, onRestart, onMenu, onSettings, onMissions, onShop }) {
  const xpMax = levelThreshold(profile.level);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <section className="modal-card pause-card game-menu-card">
        <h2>Game Menu</h2>
        <div className="menu-progress">
          <StatPill icon={Coins} label="Coins" value={profile.coins.toLocaleString()} />
          <StatPill icon={Star} label="Level" value={profile.level} />
          <StatPill icon={Gift} label="Chest" value={`${profile.chestProgress}/${CHEST_MAX}`} />
        </div>
        <div className="menu-bars">
          <ProgressBar value={profile.xp} max={xpMax} label="XP" />
          <ProgressBar value={profile.chestProgress} max={CHEST_MAX} label="Chest" />
        </div>
        <button className="primary-button" type="button" onClick={onResume}>
          <Play size={20} aria-hidden="true" />
          <span>Resume</span>
        </button>
        <div className="modal-action-grid">
          <button className="secondary-button" type="button" onClick={onMissions}>
            <Target size={18} aria-hidden="true" />
            <span>Missions</span>
          </button>
          <button className="secondary-button" type="button" onClick={onShop}>
            <ShoppingBag size={18} aria-hidden="true" />
            <span>Shop</span>
          </button>
        </div>
        <button className="secondary-button" type="button" onClick={onRestart}>
          <RotateCcw size={18} aria-hidden="true" />
          <span>Restart</span>
        </button>
        <button className="secondary-button" type="button" onClick={onSettings}>
          <Settings size={18} aria-hidden="true" />
          <span>Settings</span>
        </button>
        <button className="secondary-button" type="button" onClick={onMenu}>
          <Home size={18} aria-hidden="true" />
          <span>Menu</span>
        </button>
      </section>
    </div>
  );
}

function ChestModal({ state, onOpen, onClose }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <section className={`modal-card chest-modal ${state.reward ? "opened" : ""}`}>
        <button className="round-button close" type="button" onClick={onClose} title="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="chest-visual" aria-hidden="true">
          <span className="chest-rays" />
          <Gift size={54} />
        </div>
        <h2>{state.reward ? "Chest Opened" : "Chest Ready"}</h2>
        {state.reward ? (
          <p className="reward-line">{state.reward.label}</p>
        ) : (
          <button className="primary-button" type="button" onClick={onOpen}>
            <Gift size={18} aria-hidden="true" />
            <span>Open Chest</span>
          </button>
        )}
      </section>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className="toast">{toast}</div>;
}

function ComboFlash({ label }) {
  if (!label) return null;
  return <div className="combo-flash">{label}</div>;
}

function PraiseFlash({ label }) {
  if (!label) return null;
  const letters = [...label];
  const sparks = Array.from({ length: 18 }, (_, index) => ({
    id: `spark-${index}`,
    angle: index * 20,
    distance: 92 + (index % 4) * 18,
    delay: 25 + index * 18,
    size: 5 + (index % 3) * 2,
  }));
  const shards = Array.from({ length: 10 }, (_, index) => ({
    id: `shard-${index}`,
    angle: index * 36 + 12,
    distance: 76 + (index % 3) * 24,
    delay: 40 + index * 24,
  }));

  return (
    <div className={`praise-flash intensity-${Math.min(4, Math.ceil(label.length / 4))}`}>
      <span className="praise-shockwave" aria-hidden="true" />
      <span className="praise-shockwave praise-shockwave-delayed" aria-hidden="true" />
      <span className="praise-rays" aria-hidden="true" />
      <span className="praise-glow" aria-hidden="true" />
      {sparks.map((spark) => (
        <i
          className="praise-spark"
          key={spark.id}
          style={{
            "--angle": `${spark.angle}deg`,
            "--counter-angle": `${-spark.angle}deg`,
            "--distance": `${spark.distance}px`,
            "--spark-delay": `${spark.delay}ms`,
            "--spark-size": `${spark.size}px`,
          }}
          aria-hidden="true"
        />
      ))}
      {shards.map((shard) => (
        <i
          className="praise-shard"
          key={shard.id}
          style={{
            "--angle": `${shard.angle}deg`,
            "--counter-angle": `${-shard.angle}deg`,
            "--distance": `${shard.distance}px`,
            "--spark-delay": `${shard.delay}ms`,
          }}
          aria-hidden="true"
        />
      ))}
      <div className="praise-art">
        <span className="praise-sweep" aria-hidden="true" />
        <span className="praise-text" aria-label={label}>
          {letters.map((letter, index) => (
            <span
              className={letter === " " ? "praise-letter gap" : "praise-letter"}
              key={`${letter}-${index}`}
              style={{ "--letter-delay": `${index * 24}ms` }}
              aria-hidden="true"
            >
              {letter}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function LevelFlash({ level }) {
  if (!level) return null;
  return <div className="level-flash">Level {level}</div>;
}

function App() {
  const [profile, setProfile] = useState(() => normalizeProfile(readJson(STORAGE_KEYS.profile)));
  const [run, setRun] = useState(() => reviveRunFromStorage(readJson(STORAGE_KEYS.run)) || createRun());
  const [screen, setScreen] = useState("menu");
  const [returnScreen, setReturnScreen] = useState("menu");
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const [activePower, setActivePower] = useState(null);
  const [clearMarks, setClearMarks] = useState([]);
  const [particles, setParticles] = useState([]);
  const [toast, setToast] = useState("");
  const [comboFlash, setComboFlash] = useState("");
  const [praiseFlash, setPraiseFlash] = useState("");
  const [levelFlash, setLevelFlash] = useState(0);
  const [lastReward, setLastReward] = useState(null);
  const [chestState, setChestState] = useState(null);
  const [paused, setPaused] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const boardRef = useRef(null);
  const toastTimer = useRef(null);
  const rewardTimer = useRef(null);
  const praiseTimer = useRef(null);
  const audioUnlockedRef = useRef(false);

  const selectedSkin = useMemo(() => getSkin(profile.selectedSkin), [profile.selectedSkin]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.run, run);
  }, [run]);

  useEffect(() => {
    setMusic(Boolean(profile.settings.music && audioUnlocked));
    return () => setMusic(false);
  }, [profile.settings.music, audioUnlocked]);

  function unlockAudio() {
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    if (audioContext?.state === "suspended") audioContext.resume();
  }

  function notify(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1700);
  }

  function showReward(reward) {
    setLastReward(reward);
    window.clearTimeout(rewardTimer.current);
    rewardTimer.current = window.setTimeout(() => setLastReward(null), 900);
  }

  function addParticles(amount) {
    const nextParticles = Array.from({ length: amount }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      left: 30 + Math.random() * 40,
      top: 28 + Math.random() * 36,
      dx: -90 + Math.random() * 180,
      dy: -120 + Math.random() * 110,
      color: index % selectedSkin.swatches.length,
    }));
    setParticles(nextParticles);
    window.setTimeout(() => setParticles([]), 760);
  }

  function flashCombo(combo) {
    const label = comboLabel(combo);
    if (!label) return;
    setComboFlash(label);
    window.setTimeout(() => setComboFlash(""), 850);
  }

  function flashPraise(label) {
    if (!label) return;
    setPraiseFlash(label);
    window.clearTimeout(praiseTimer.current);
    praiseTimer.current = window.setTimeout(() => setPraiseFlash(""), 1050);
    speakPraise(label, profile.settings.voice && audioUnlockedRef.current);
  }

  function triggerShake(strong = false) {
    setShake(true);
    haptic(profile.settings.haptics, strong ? [28, 30, 28] : 24);
    window.setTimeout(() => setShake(false), strong ? 380 : 260);
  }

  function finalizeRunAfterMove(baseRun, boardAfterClear, piecesAfterPlacement) {
    const generatedPieces = piecesAfterPlacement.every((piece) => piece.placed) ? generateHand() : piecesAfterPlacement;
    const nextPieces = syncPiecesWithBonus(generatedPieces, baseRun.bonus);
    const isOver = !canAnyPieceFit(boardAfterClear, nextPieces);
    const finalRun = { ...baseRun, board: boardAfterClear, pieces: nextPieces, isOver };
    setRun(finalRun);
    if (isOver) {
      playSound("bad", profile.settings.sound);
      setScreen("gameover");
    }
    return finalRun;
  }

  function handlePlacePiece(pieceId, row, col) {
    unlockAudio();
    if (run.isOver || clearing || paused) return false;
    const piece = run.pieces.find((item) => item.id === pieceId);
    if (!piece || !canPlacePiece(run.board, piece, row, col)) {
      notify("No room there");
      playSound("bad", profile.settings.sound);
      haptic(profile.settings.haptics, 12);
      return false;
    }

    const placedBoard = placePiece(run.board, piece, row, col, profile.selectedSkin);
    const completed = findCompletedLines(placedBoard);
    const bonusBeforeMove = run.bonus || { active: false, movesLeft: 0, misses: 0 };
    const reward = getPlacementReward(piece.cells.length, completed.count, run.combo, {
      bonusActive: bonusBeforeMove.active,
    });
    const score = run.score + reward.score;
    const totalLines = run.totalLines + completed.count;
    const nextComboMisses = completed.count > 0 ? 0 : (run.comboMisses || 0) + 1;
    const comboAfterMove = completed.count > 0 ? reward.nextCombo : nextComboMisses >= 3 ? 0 : run.combo;
    const bonusTriggered = shouldStartBonusStage({
      previousLines: run.totalLines,
      nextLines: totalLines,
      nextCombo: comboAfterMove,
      lineCount: completed.count,
      bonusActive: bonusBeforeMove.active,
    });
    const bonusAfterMove = bonusTriggered
      ? { active: true, movesLeft: BONUS_STAGE.maxMoves, misses: 0 }
      : advanceBonusStage(bonusBeforeMove, completed.count);
    const piecesAfterPlacement = syncPiecesWithBonus(
      run.pieces.map((item) => (item.id === pieceId ? { ...item, placed: true } : item)),
      bonusAfterMove,
    );
    const progress = applyGameProgress(profile, {
      score,
      coins: reward.coins,
      xp: reward.xp,
      previousLines: run.totalLines,
      linesCleared: completed.count,
      comboEvent: completed.count > 0 && reward.nextCombo >= 2 ? 1 : 0,
    });
    const baseRun = {
      ...run,
      board: placedBoard,
      pieces: piecesAfterPlacement,
      score,
      combo: comboAfterMove,
      comboMisses: comboAfterMove > 0 ? nextComboMisses : 0,
      bonus: bonusAfterMove,
      totalLines,
      coinsEarned: (run.coinsEarned || 0) + Math.max(0, progress.profile.coins - profile.coins),
      xpEarned: (run.xpEarned || 0) + reward.xp,
      moves: run.moves + 1,
    };

    setProfile(progress.profile);
    if (progress.xpRewards.levelsGained > 0) {
      setLevelFlash(progress.profile.level);
      window.setTimeout(() => setLevelFlash(0), 1100);
    }
    if (bonusTriggered) {
      notify(`Rush Bonus x${BONUS_STAGE.scoreMultiplier}`);
      playSound("reward", profile.settings.sound);
    }
    if (progress.lineRewards.chestReady && progress.profile.chestProgress >= CHEST_MAX) {
      window.setTimeout(() => setChestState({ reward: null }), 360);
    }

    const praise = praiseLabel(completed.count, comboAfterMove);
    playSound(
      completed.count
        ? completed.count > 1 || reward.nextCombo >= 3
          ? "bigClear"
          : comboAfterMove >= 2
            ? "combo"
            : "clear"
        : "place",
      profile.settings.sound,
    );
    showReward({ score: reward.score, coins: reward.coins, lines: completed.count });
    if (completed.count > 0) {
      setRun(baseRun);
      setClearing(true);
      const cleared = clearCompletedLines(placedBoard, completed);
      setClearMarks(
        cleared.clearedCells.map(([cellRow, cellCol]) => ({
          row: cellRow,
          col: cellCol,
          delay: (cellRow + cellCol) * 14,
        })),
      );
      addParticles(22 + completed.count * 16 + comboAfterMove * 7);
      flashCombo(comboAfterMove);
      flashPraise(praise);
      triggerShake(completed.count > 1 || comboAfterMove >= 2);
      window.setTimeout(() => {
        setClearMarks([]);
        finalizeRunAfterMove(baseRun, cleared.board, piecesAfterPlacement);
        setClearing(false);
      }, 470);
    } else {
      addParticles(8);
      finalizeRunAfterMove(baseRun, placedBoard, piecesAfterPlacement);
    }
    return true;
  }

  function handleBeginDrag(event, piece) {
    unlockAudio();
    if (piece.placed || run.isOver || clearing || paused) return;
    event.preventDefault();
    setActivePower(null);
    const nextDrag = { piece, pieceId: piece.id, x: event.clientX, y: event.clientY };
    setDrag(nextDrag);
    const cell = getPointCell(boardRef.current, piece, { x: event.clientX, y: event.clientY });
    if (cell) {
      setHover({ ...cell, piece, valid: canPlacePiece(run.board, piece, cell.row, cell.col) });
    }
  }

  useEffect(() => {
    if (!drag) return undefined;

    function onMove(event) {
      event.preventDefault();
      const cell = getPointCell(boardRef.current, drag.piece, { x: event.clientX, y: event.clientY });
      setDrag((current) => (current ? { ...current, x: event.clientX, y: event.clientY } : current));
      if (cell) {
        setHover({ ...cell, piece: drag.piece, valid: canPlacePiece(run.board, drag.piece, cell.row, cell.col) });
      } else {
        setHover(null);
      }
    }

    function onUp() {
      if (hover) handlePlacePiece(drag.pieceId, hover.row, hover.col);
      else notify("Drop on the board");
      setDrag(null);
      setHover(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, hover, run.board]);

  function startNewGame() {
    unlockAudio();
    const nextRun = createRun();
    setRun(nextRun);
    setPaused(false);
    setActivePower(null);
    setScreen("game");
  }

  function openSettingsScreen(from) {
    setReturnScreen(from);
    setConfirmReset(false);
    setScreen("settings");
  }

  function backFromPanel() {
    setScreen(returnScreen);
  }

  function handlePowerup(powerupId) {
    unlockAudio();
    if (run.isOver || clearing) return;
    if ((profile.powerups[powerupId] || 0) <= 0) {
      notify("Get more in shop");
      setScreen("shop");
      setReturnScreen("game");
      return;
    }

    if (powerupId === "shuffle") {
      const spent = spendPowerup(profile, "shuffle");
      const fresh = generateHand();
      let nextIndex = 0;
      const pieces = syncPiecesWithBonus(run.pieces.map((piece) => {
        if (piece.placed) return piece;
        const nextPiece = fresh[nextIndex] || fresh[0];
        nextIndex += 1;
        return nextPiece;
      }), run.bonus);
      const nextRun = { ...run, pieces, isOver: !canAnyPieceFit(run.board, pieces) };
      setProfile(spent.profile);
      setRun(nextRun);
      playSound("reward", profile.settings.sound);
      notify("Pieces shuffled");
      if (nextRun.isOver) setScreen("gameover");
      return;
    }

    setActivePower((current) => (current === powerupId ? null : powerupId));
    notify(powerupId === "hammer" ? "Tap one block" : "Tap a 3x3 target");
  }

  function handleCellAction(row, col) {
    unlockAudio();
    if (!activePower || clearing) return;
    const result = activePower === "hammer" ? removeCell(run.board, row, col) : clearArea(run.board, row, col);
    if (result.removed <= 0) {
      notify("Pick filled blocks");
      playSound("bad", profile.settings.sound);
      haptic(profile.settings.haptics, 10);
      return;
    }
    const spent = spendPowerup(profile, activePower);
    if (!spent.spent) {
      notify("No power-up left");
      return;
    }

    const scoreGain = activePower === "hammer" ? 15 : result.removed * 12;
    const score = run.score + scoreGain;
    const progress = applyGameProgress(spent.profile, {
      score,
      coins: Math.floor(scoreGain / 80),
      xp: Math.max(3, result.removed * 4),
      previousLines: run.totalLines,
      linesCleared: 0,
      comboEvent: 0,
    });
    const isOver = !canAnyPieceFit(result.board, run.pieces);
    setProfile(progress.profile);
    setRun({
      ...run,
      board: result.board,
      score,
      coinsEarned: (run.coinsEarned || 0) + Math.max(0, progress.profile.coins - spent.profile.coins),
      xpEarned: (run.xpEarned || 0) + Math.max(3, result.removed * 4),
      isOver,
    });
    setActivePower(null);
    showReward({ score: scoreGain, coins: Math.floor(scoreGain / 80), lines: 0 });
    addParticles(activePower === "hammer" ? 10 : 24);
    triggerShake(activePower === "bomb");
    playSound("clear", profile.settings.sound);
    if (isOver) setScreen("gameover");
  }

  function handleClaimMission(missionId) {
    unlockAudio();
    const result = claimMission(profile, missionId);
    if (!result.claimed) {
      notify("Mission not ready");
      return;
    }
    setProfile(result.profile);
    playSound("reward", profile.settings.sound);
    notify(`+${result.reward} coins`);
  }

  function handleBuySkin(skinId) {
    unlockAudio();
    const result = buySkin(profile, skinId);
    if (!result.purchased) {
      notify("Not enough coins");
      return;
    }
    setProfile(result.profile);
    playSound("reward", profile.settings.sound);
    notify("Theme unlocked");
  }

  function handleSelectSkin(skinId) {
    unlockAudio();
    const result = selectSkin(profile, skinId);
    if (result.selected) {
      setProfile(result.profile);
      notify("Theme selected");
    }
  }

  function handleBuyPowerup(powerupId) {
    unlockAudio();
    const result = buyPowerup(profile, powerupId);
    if (!result.purchased) {
      notify("Not enough coins");
      return;
    }
    setProfile(result.profile);
    playSound("reward", profile.settings.sound);
    notify(`${POWERUPS[powerupId].name} added`);
  }

  function handleOpenChest() {
    unlockAudio();
    setChestState({ reward: null });
  }

  function handleChestReward() {
    unlockAudio();
    const result = openChest(profile);
    if (!result.opened) return;
    setProfile(result.profile);
    setChestState({ reward: result.reward });
    playSound("reward", profile.settings.sound);
    triggerShake(false);
  }

  function toggleSetting(setting) {
    unlockAudio();
    setProfile({
      ...profile,
      settings: {
        ...profile.settings,
        [setting]: !profile.settings[setting],
      },
    });
  }

  function confirmResetProgress() {
    const nextProfile = createInitialProfile();
    const nextRun = createRun();
    setProfile(nextProfile);
    setRun(nextRun);
    setScreen("menu");
    setConfirmReset(false);
    window.localStorage.removeItem(STORAGE_KEYS.profile);
    window.localStorage.removeItem(STORAGE_KEYS.run);
    notify("Progress reset");
  }

  const shellStyle = {
    "--skin-0": selectedSkin.swatches[0],
    "--skin-1": selectedSkin.swatches[1],
    "--skin-2": selectedSkin.swatches[2],
    "--skin-3": selectedSkin.swatches[3],
  };

  return (
    <div className={`app-shell ${shake ? "shake" : ""} ${run.bonus?.active ? "rush-active" : ""}`} style={shellStyle}>
      <div className="phone-frame">
        {screen === "menu" && (
          <MainMenu
            run={run}
            profile={profile}
            onPlay={() => setScreen("game")}
            onNewGame={startNewGame}
            onShop={() => {
              setReturnScreen("menu");
              setScreen("shop");
            }}
            onMissions={() => {
              setReturnScreen("menu");
              setScreen("missions");
            }}
            onSettings={() => openSettingsScreen("menu")}
          />
        )}
        {screen === "game" && (
          <GameScreen
            run={run}
            profile={profile}
            boardRef={boardRef}
            hover={hover}
            clearMarks={clearMarks}
            particles={particles}
            lastReward={lastReward}
            praise={praiseFlash}
            drag={drag}
            activePower={activePower}
            onBeginDrag={handleBeginDrag}
            onSelectPowerup={handlePowerup}
            onCellAction={handleCellAction}
            onPause={() => setPaused(true)}
            onOpenSettings={() => openSettingsScreen("game")}
          />
        )}
        {screen === "shop" && (
          <ShopScreen
            profile={profile}
            onBack={backFromPanel}
            onBuySkin={handleBuySkin}
            onSelectSkin={handleSelectSkin}
            onBuyPowerup={handleBuyPowerup}
          />
        )}
        {screen === "missions" && (
          <MissionsScreen
            profile={profile}
            onBack={backFromPanel}
            onClaim={handleClaimMission}
            onOpenChest={handleOpenChest}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen
            profile={profile}
            onBack={backFromPanel}
            onToggleSetting={toggleSetting}
            onResetProgress={() => setConfirmReset(true)}
            confirmReset={confirmReset}
            onConfirmReset={confirmResetProgress}
          />
        )}
        {screen === "gameover" && (
          <GameOverScreen
            run={run}
            profile={profile}
            onRestart={startNewGame}
            onMenu={() => setScreen("menu")}
            onShop={() => {
              setReturnScreen("gameover");
              setScreen("shop");
            }}
          />
        )}
      </div>

      {paused && (
        <PauseModal
          profile={profile}
          onResume={() => setPaused(false)}
          onRestart={() => {
            setPaused(false);
            startNewGame();
          }}
          onMissions={() => {
            setPaused(false);
            setReturnScreen("game");
            setScreen("missions");
          }}
          onShop={() => {
            setPaused(false);
            setReturnScreen("game");
            setScreen("shop");
          }}
          onMenu={() => {
            setPaused(false);
            setScreen("menu");
          }}
          onSettings={() => {
            setPaused(false);
            openSettingsScreen("game");
          }}
        />
      )}
      {chestState && <ChestModal state={chestState} onOpen={handleChestReward} onClose={() => setChestState(null)} />}
      <Toast toast={toast} />
      <ComboFlash label={comboFlash} />
      <LevelFlash level={levelFlash} />
    </div>
  );
}

export default App;

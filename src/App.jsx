import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bomb,
  Check,
  Coins,
  Gift,
  Hammer,
  Hand,
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
  COMBO_MISS_LIMIT,
  MISSION_DEFS,
  POWERUPS,
  SKINS,
  STORAGE_KEYS,
  advanceBonusStage,
  advanceComboState,
  applyGameProgress,
  bonusizePieces,
  buyPowerup,
  buySkin,
  canAnyPieceFit,
  canPlacePiece,
  claimMission,
  clearArea,
  clearCompletedLines,
  createInitialProfile,
  createRun,
  findCompletedLines,
  generateHand,
  getPieceBounds,
  getPieceColorIndex,
  getPlacementLines,
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
import {
  getBoardGridMetrics,
  getDragLift,
  getPlacementCell,
} from "./game/dragPlacement.js";

let audioContext;
let audioMaster;
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
  return getPlacementCell(piece, point, getBoardGridMetrics(boardElement));
}

function getBoardCellSize(boardElement) {
  const metrics = getBoardGridMetrics(boardElement);
  return metrics ? Math.min(metrics.cellWidth, metrics.cellHeight) : 44;
}

function getAudioSystem() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext ||= new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  if (!audioMaster) {
    const compressor = audioContext.createDynamicsCompressor();
    const gain = audioContext.createGain();
    compressor.threshold.value = -16;
    compressor.knee.value = 14;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    gain.gain.value = 0.72;
    compressor.connect(gain);
    gain.connect(audioContext.destination);
    audioMaster = compressor;
  }
  return { context: audioContext, output: audioMaster };
}

function scheduleTone(context, output, {
  frequency,
  endFrequency = frequency,
  start,
  duration,
  volume,
  type = "sine",
}) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function scheduleNoise(context, output, {
  start,
  duration,
  volume,
  frequency = 1800,
}) {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start);
}

function playSound(kind, enabled, detail = {}) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const system = getAudioSystem();
    if (!system) return;
    const { context, output } = system;
    const now = context.currentTime + 0.004;

    if (kind === "place") {
      scheduleTone(context, output, {
        frequency: 310,
        endFrequency: 185,
        start: now,
        duration: 0.055,
        volume: 0.045,
        type: "triangle",
      });
      scheduleTone(context, output, {
        frequency: 880,
        endFrequency: 520,
        start: now,
        duration: 0.025,
        volume: 0.016,
        type: "square",
      });
      return;
    }

    if (kind === "bad") {
      scheduleTone(context, output, {
        frequency: 155,
        endFrequency: 82,
        start: now,
        duration: 0.085,
        volume: 0.05,
        type: "sawtooth",
      });
      return;
    }

    if (kind === "gameOver") {
      [330, 247, 196].forEach((frequency, index) => {
        scheduleTone(context, output, {
          frequency,
          endFrequency: frequency * 0.82,
          start: now + index * 0.105,
          duration: 0.22,
          volume: 0.04,
          type: "triangle",
        });
      });
      return;
    }

    if (kind === "reward") {
      [660, 880, 1320].forEach((frequency, index) => {
        scheduleTone(context, output, {
          frequency,
          endFrequency: frequency * 1.08,
          start: now + index * 0.055,
          duration: 0.16,
          volume: 0.045,
          type: "sine",
        });
      });
      scheduleNoise(context, output, { start: now, duration: 0.1, volume: 0.018, frequency: 3600 });
      return;
    }

    if (kind === "praise") {
      [880, 1174.66, 1567.98].forEach((frequency, index) => {
        scheduleTone(context, output, {
          frequency,
          endFrequency: frequency * 1.06,
          start: now + index * 0.038,
          duration: 0.24,
          volume: 0.032,
          type: "sine",
        });
      });
      return;
    }

    const lines = Math.max(1, detail.lines || 1);
    const combo = Math.max(1, detail.combo || 1);
    const big = kind === "bigClear" || lines > 1 || combo >= 3;
    const root = 440 * 2 ** (Math.min(5, combo - 1) / 12);
    const notes = big ? [1, 1.25, 1.5, 2] : [1, 1.25, 1.5];
    scheduleNoise(context, output, {
      start: now,
      duration: big ? 0.17 : 0.11,
      volume: big ? 0.045 : 0.027,
      frequency: big ? 2200 : 3000,
    });
    if (big) {
      scheduleTone(context, output, {
        frequency: 135,
        endFrequency: 62,
        start: now,
        duration: 0.22,
        volume: 0.07,
        type: "triangle",
      });
    }
    notes.forEach((ratio, index) => {
      scheduleTone(context, output, {
        frequency: root * ratio,
        endFrequency: root * ratio * 1.06,
        start: now + index * 0.04,
        duration: big ? 0.24 : 0.16,
        volume: big ? 0.06 : 0.043,
        type: index % 2 ? "triangle" : "sine",
      });
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
          musicNodes?.nodes.forEach((node) => node.stop?.());
          musicNodes = null;
        }, 220);
      }
      return;
    }

    if (musicNodes) return;
    const system = getAudioSystem();
    if (!system) return;
    const { context, output } = system;
    const now = context.currentTime;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const oscA = context.createOscillator();
    const oscB = context.createOscillator();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    oscA.type = "sine";
    oscB.type = "sine";
    oscA.frequency.setValueAtTime(110, now);
    oscB.frequency.setValueAtTime(164.81, now);
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.006;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.012, now + 0.4);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    oscA.start();
    oscB.start();
    lfo.start();
    musicNodes = { gain, nodes: [oscA, oscB, lfo] };
  } catch {
    musicNodes = null;
  }
}

function haptic(enabled, pattern = 18) {
  if (enabled && navigator.vibrate) navigator.vibrate(pattern);
}

function praiseLabel(lineCount, combo) {
  if (combo >= 5) return "UNBELIEVABLE";
  if (combo >= 4 || lineCount >= 4) return "EXCELLENT";
  if (combo >= 3 || lineCount >= 3) return "AMAZING";
  if (combo >= 2 || lineCount >= 2) return "GREAT";
  return "";
}

function AnimatedScore({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    const delta = value - from;
    previousValue.current = value;
    if (delta <= 0) {
      setDisplayValue(value);
      return undefined;
    }

    const duration = Math.min(520, 220 + Math.log10(delta + 1) * 90);
    const startedAt = performance.now();
    let frame;
    const update = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(Math.round(from + delta * eased));
      if (progress < 1) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <h1>{displayValue.toLocaleString()}</h1>;
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
  if (!piece || piece.placed) {
    return (
      <div className="empty-piece">
        <Check size={14} aria-hidden="true" />
        <span>Placed</span>
      </div>
    );
  }
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

function Board({
  board,
  boardRef,
  skinId,
  hover,
  previewCompleted,
  clearMarks,
  landingMarks,
  activePower,
  onCellAction,
}) {
  const selectedSkin = getSkin(skinId);
  const previewCells = new Map();
  if (hover?.piece) {
    hover.piece.cells.forEach(([pieceRow, pieceCol], index) => {
      previewCells.set(
        `${hover.row + pieceRow}-${hover.col + pieceCol}`,
        getPieceColorIndex(hover.piece, index),
      );
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
  const landedCells = new Map(
    landingMarks.map((mark) => [`${mark.row}-${mark.col}`, mark.delay || 0]),
  );
  const previewRows = new Set(previewCompleted?.rows || []);
  const previewCols = new Set(previewCompleted?.cols || []);

  return (
    <div
      ref={boardRef}
      className={`board ${activePower ? "targeting" : ""} ${previewCompleted?.count ? "clear-ready" : ""}`}
      style={{ "--board-bg": selectedSkin.board }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const previewColorIndex = previewCells.get(key);
          const preview = previewColorIndex !== undefined;
          const clearDelay = clearCells.get(key);
          const clearing = clearDelay !== undefined;
          const landDelay = landedCells.get(key);
          const landed = landDelay !== undefined;
          const lineReady = previewRows.has(rowIndex) || previewCols.has(colIndex);
          const cellSkin = cell ? getSkin(cell.skin) : selectedSkin;
          const color = cell ? cellSkin.swatches[cell.colorIndex % cellSkin.swatches.length] : undefined;
          const previewColor = preview
            ? selectedSkin.swatches[previewColorIndex % selectedSkin.swatches.length]
            : undefined;
          return (
            <button
              type="button"
              className={[
                "board-cell",
                cell ? "filled" : "",
                preview ? "preview" : "",
                preview && hover?.valid ? "valid" : "",
                preview && !hover?.valid ? "invalid" : "",
                lineReady ? "line-ready" : "",
                clearing ? "clearing" : "",
                landed ? "landed" : "",
                activePower ? "tool-target" : "",
              ].join(" ")}
              key={key}
              style={{
                ...(color && !preview ? { background: color } : {}),
                ...(previewColor ? { "--preview-color": previewColor } : {}),
                ...(clearing ? { "--clear-delay": `${clearDelay}ms` } : {}),
                ...(landed ? { "--land-delay": `${landDelay}ms` } : {}),
              }}
              data-row={rowIndex}
              data-col={colIndex}
              data-preview={preview ? (hover?.valid ? "valid" : "invalid") : undefined}
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
  landingMarks,
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
  tutorialActive,
}) {
  const skin = getSkin(profile.selectedSkin);
  const xpMax = levelThreshold(profile.level);
  const xpPercent = Math.min(100, (profile.xp / xpMax) * 100);
  const chestPercent = Math.min(100, (profile.chestProgress / CHEST_MAX) * 100);
  const placedCount = run.pieces.filter((piece) => piece.placed).length;
  const previewCompleted = hover?.valid
    ? getPlacementLines(run.board, hover.piece, hover.row, hover.col, profile.selectedSkin)
    : { rows: [], cols: [], count: 0 };

  return (
    <main className="game-screen">
      <header className="top-bar">
        <div className="best-chip">
          <Trophy size={14} aria-hidden="true" />
          <span>{profile.highScore.toLocaleString()}</span>
        </div>
        <div className="score-block">
          <span>Score</span>
          <span className="score-aura" aria-hidden="true" />
          <AnimatedScore value={run.score} />
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

      <section className="run-progress" aria-label="Run progress">
        <div className="run-progress-item">
          <Star size={13} aria-hidden="true" />
          <span>Lv {profile.level}</span>
          <div className="micro-track" aria-hidden="true">
            <i style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
        <div className={`run-progress-item ${profile.chestProgress >= CHEST_MAX ? "ready" : ""}`}>
          <Gift size={13} aria-hidden="true" />
          <span>Chest {profile.chestProgress}/{CHEST_MAX}</span>
          <div className="micro-track" aria-hidden="true">
            <i style={{ width: `${chestPercent}%` }} />
          </div>
        </div>
      </section>

      {(run.combo > 0 || run.bonus?.active) && (
        <section className="run-status" aria-label="Active bonuses">
          {run.combo > 0 && (
            <div className="combo-meter" aria-live="polite">
              <span>Chain</span>
              <strong>x{run.combo}</strong>
              <div className="combo-life" aria-label={`${COMBO_MISS_LIMIT - run.comboMisses} chain saves left`}>
                {Array.from({ length: COMBO_MISS_LIMIT }, (_, index) => (
                  <i className={index < COMBO_MISS_LIMIT - run.comboMisses ? "active" : ""} key={index} />
                ))}
              </div>
            </div>
          )}
          {run.bonus?.active && (
            <div className="rush-meter" aria-live="polite">
              <Zap size={13} aria-hidden="true" />
              <span>Rush x{BONUS_STAGE.scoreMultiplier}</span>
              <strong>{run.bonus.movesLeft}</strong>
            </div>
          )}
        </section>
      )}

      <div className="board-wrap">
        <Board
          board={run.board}
          boardRef={boardRef}
          skinId={profile.selectedSkin}
          hover={hover}
          previewCompleted={previewCompleted}
          clearMarks={clearMarks}
          landingMarks={landingMarks}
          activePower={activePower}
          onCellAction={onCellAction}
        />
        {previewCompleted.count > 0 && (
          <div className="clear-preview-cue" aria-live="polite">
            <Zap size={13} aria-hidden="true" />
            Clear {previewCompleted.count}
          </div>
        )}
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
          <div
            className="reward-burst"
            style={{ left: `${lastReward.left}%`, top: `${lastReward.top}%` }}
            aria-live="polite"
          >
            <strong>+{lastReward.score}</strong>
            <span>
              {lastReward.lines > 0 ? `${lastReward.lines} line${lastReward.lines > 1 ? "s" : ""}` : "Nice move"}
            </span>
          </div>
        )}
      </div>

      <section className="piece-zone" aria-label="Available pieces">
        <div className="hand-status">
          <span>Place all 3</span>
          <div className="hand-pips" aria-hidden="true">
            {run.pieces.map((piece) => (
              <i className={piece.placed ? "done" : ""} key={piece.id} />
            ))}
          </div>
          <strong>{3 - placedCount} left</strong>
        </div>
        <div className="piece-tray">
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
        </div>
      </section>

      <section className="power-row compact-tools" aria-label="Power-ups">
        <button
          className={`power-button ${activePower === "hammer" ? "active" : ""}`}
          type="button"
          onClick={() => onSelectPowerup("hammer")}
          aria-label={`Hammer, ${profile.powerups.hammer || 0} left`}
          title="Hammer"
        >
          <Hammer size={18} aria-hidden="true" />
          <strong>{profile.powerups.hammer || 0}</strong>
        </button>
        <button
          className="power-button"
          type="button"
          onClick={() => onSelectPowerup("shuffle")}
          aria-label={`Shuffle, ${profile.powerups.shuffle || 0} left`}
          title="Shuffle"
        >
          <Shuffle size={18} aria-hidden="true" />
          <strong>{profile.powerups.shuffle || 0}</strong>
        </button>
        <button
          className={`power-button ${activePower === "bomb" ? "active" : ""}`}
          type="button"
          onClick={() => onSelectPowerup("bomb")}
          aria-label={`Bomb, ${profile.powerups.bomb || 0} left`}
          title="Bomb"
        >
          <Bomb size={18} aria-hidden="true" />
          <strong>{profile.powerups.bomb || 0}</strong>
        </button>
      </section>

      {activePower && (
        <div className="tool-cue" aria-live="polite">
          {activePower === "hammer" ? "Tap a filled cell" : "Tap the blast center"}
        </div>
      )}

      {drag && (
        <div
          className="drag-ghost"
          style={{
            "--drag-x": `${drag.x}px`,
            "--drag-y": `${drag.y - drag.lift}px`,
            "--drag-cell": `${drag.cellSize}px`,
          }}
          aria-hidden="true"
        >
          <PiecePreview piece={drag.piece} skinId={profile.selectedSkin} compact />
        </div>
      )}
      {tutorialActive && (
        <div className="play-coach" role="status" aria-live="polite">
          <Hand size={24} aria-hidden="true" />
          <div>
            <strong>Drag a block onto the board</strong>
            <span>Complete a row or column to clear it</span>
          </div>
        </div>
      )}
      {praise && <PraiseFlash label={praise.label} combo={praise.combo} />}
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
          <span>Announcer FX</span>
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

function PraiseFlash({ label, combo }) {
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
        <span className="praise-kicker">{combo >= 2 ? `Combo x${combo}` : "Multi clear"}</span>
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
  const [landingMarks, setLandingMarks] = useState([]);
  const [particles, setParticles] = useState([]);
  const [toast, setToast] = useState("");
  const [praiseFlash, setPraiseFlash] = useState(null);
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
  const gameOverTimer = useRef(null);
  const landingTimer = useRef(null);
  const hoverRef = useRef(null);
  const dragFrame = useRef(null);
  const pendingPointer = useRef(null);
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
    setLastReward({ left: 50, top: 50, ...reward });
    window.clearTimeout(rewardTimer.current);
    rewardTimer.current = window.setTimeout(() => setLastReward(null), 820);
  }

  function addParticles(amount, origins = [[3.5, 3.5]]) {
    const nextParticles = Array.from({ length: amount }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      ...(() => {
        const [row, col] = origins[index % origins.length];
        return {
          left: ((col + 0.5) / BOARD_SIZE) * 100 + (Math.random() - 0.5) * 4,
          top: ((row + 0.5) / BOARD_SIZE) * 100 + (Math.random() - 0.5) * 4,
          dx: -78 + Math.random() * 156,
          dy: -105 + Math.random() * 90,
          color: index % selectedSkin.swatches.length,
        };
      })(),
    }));
    setParticles(nextParticles);
    window.setTimeout(() => setParticles([]), 760);
  }

  function flashPraise(label, combo) {
    if (!label) return;
    setPraiseFlash({ label, combo });
    window.clearTimeout(praiseTimer.current);
    praiseTimer.current = window.setTimeout(() => setPraiseFlash(null), 1180);
    playSound("praise", profile.settings.voice && audioUnlockedRef.current);
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
      playSound("gameOver", profile.settings.sound);
      window.clearTimeout(gameOverTimer.current);
      gameOverTimer.current = window.setTimeout(() => setScreen("gameover"), 520);
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
    const pieceBounds = getPieceBounds(piece);
    const placementCenter = {
      left: ((col + pieceBounds.width / 2) / BOARD_SIZE) * 100,
      top: ((row + pieceBounds.height / 2) / BOARD_SIZE) * 100,
    };
    setLandingMarks(
      piece.cells.map(([cellRow, cellCol], index) => ({
        row: row + cellRow,
        col: col + cellCol,
        delay: index * 28,
      })),
    );
    window.clearTimeout(landingTimer.current);
    landingTimer.current = window.setTimeout(() => setLandingMarks([]), 460);
    const completed = findCompletedLines(placedBoard);
    const bonusBeforeMove = run.bonus || { active: false, movesLeft: 0, misses: 0 };
    const reward = getPlacementReward(piece.cells.length, completed.count, run.combo, {
      bonusActive: bonusBeforeMove.active,
    });
    const score = run.score + reward.score;
    const totalLines = run.totalLines + completed.count;
    const comboState = advanceComboState(run.combo, run.comboMisses || 0, completed.count);
    const comboAfterMove = comboState.combo;
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
      comboMisses: comboState.misses,
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
      { lines: completed.count, combo: comboAfterMove },
    );
    if (completed.count > 0) {
      setRun(baseRun);
      setClearing(true);
      const cleared = clearCompletedLines(placedBoard, completed);
      const rewardCenter = cleared.clearedCells.reduce(
        (center, [cellRow, cellCol]) => ({
          row: center.row + cellRow / cleared.clearedCells.length,
          col: center.col + cellCol / cleared.clearedCells.length,
        }),
        { row: 0, col: 0 },
      );
      setClearMarks(
        cleared.clearedCells.map(([cellRow, cellCol]) => ({
          row: cellRow,
          col: cellCol,
          delay: Math.min(
            completed.rows.includes(cellRow) ? cellCol * 18 : Number.POSITIVE_INFINITY,
            completed.cols.includes(cellCol) ? cellRow * 18 : Number.POSITIVE_INFINITY,
          ),
        })),
      );
      showReward({
        score: reward.score,
        coins: reward.coins,
        lines: completed.count,
        left: ((rewardCenter.col + 0.5) / BOARD_SIZE) * 100,
        top: ((rewardCenter.row + 0.5) / BOARD_SIZE) * 100,
      });
      addParticles(18 + completed.count * 12 + comboAfterMove * 5, cleared.clearedCells);
      flashPraise(praise, comboAfterMove);
      triggerShake(completed.count > 1 || comboAfterMove >= 2);
      window.setTimeout(() => {
        setClearMarks([]);
        finalizeRunAfterMove(baseRun, cleared.board, piecesAfterPlacement);
        setClearing(false);
      }, 470);
    } else {
      showReward({
        score: reward.score,
        coins: reward.coins,
        lines: 0,
        ...placementCenter,
      });
      addParticles(Math.min(9, 4 + piece.cells.length), piece.cells.map(([cellRow, cellCol]) => [
        row + cellRow,
        col + cellCol,
      ]));
      haptic(profile.settings.haptics, 8);
      finalizeRunAfterMove(baseRun, placedBoard, piecesAfterPlacement);
    }
    return true;
  }

  function handleBeginDrag(event, piece) {
    unlockAudio();
    if (!event.isPrimary || event.button > 0 || piece.placed || run.isOver || clearing || paused) return;
    event.preventDefault();
    if (!profile.tutorialSeen) {
      setProfile((current) => ({ ...current, tutorialSeen: true }));
    }
    setActivePower(null);
    const cellSize = getBoardCellSize(boardRef.current);
    const lift = getDragLift(cellSize);
    const nextDrag = {
      piece,
      pieceId: piece.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cellSize,
      lift,
    };
    setDrag(nextDrag);
    const cell = getPointCell(boardRef.current, piece, { x: event.clientX, y: event.clientY - lift });
    if (cell) {
      const nextHover = { ...cell, piece, valid: canPlacePiece(run.board, piece, cell.row, cell.col) };
      hoverRef.current = nextHover;
      setHover(nextHover);
    } else {
      hoverRef.current = null;
      setHover(null);
    }
  }

  useEffect(() => {
    if (!drag) return undefined;

    function updatePointer(point) {
      const liftedPoint = { x: point.x, y: point.y - drag.lift };
      const cell = getPointCell(boardRef.current, drag.piece, liftedPoint);
      setDrag((current) => (current ? { ...current, x: point.x, y: point.y } : current));
      const nextHover = cell
        ? { ...cell, piece: drag.piece, valid: canPlacePiece(run.board, drag.piece, cell.row, cell.col) }
        : null;
      hoverRef.current = nextHover;
      setHover(nextHover);
    }

    function onMove(event) {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      pendingPointer.current = { x: event.clientX, y: event.clientY };
      if (!dragFrame.current) {
        dragFrame.current = window.requestAnimationFrame(() => {
          dragFrame.current = null;
          if (pendingPointer.current) updatePointer(pendingPointer.current);
        });
      }
    }

    function finishDrag(shouldPlace) {
      if (dragFrame.current) window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
      pendingPointer.current = null;
      const target = hoverRef.current;
      if (shouldPlace && target?.valid) {
        handlePlacePiece(drag.pieceId, target.row, target.col);
      } else if (shouldPlace && target && !target.valid) {
        playSound("bad", profile.settings.sound);
        haptic(profile.settings.haptics, 10);
      }
      setDrag(null);
      setHover(null);
      hoverRef.current = null;
    }

    function onUp(event) {
      if (event.pointerId !== drag.pointerId) return;
      updatePointer({ x: event.clientX, y: event.clientY });
      finishDrag(true);
    }

    function onCancel(event) {
      if (event.pointerId !== drag.pointerId) return;
      finishDrag(false);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (dragFrame.current) window.cancelAnimationFrame(dragFrame.current);
    };
  }, [drag?.pieceId, run.board]);

  function startNewGame() {
    unlockAudio();
    const nextRun = createRun();
    window.clearTimeout(gameOverTimer.current);
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
            landingMarks={landingMarks}
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
            tutorialActive={!profile.tutorialSeen && run.moves === 0}
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
      <LevelFlash level={levelFlash} />
    </div>
  );
}

export default App;

import { useEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import {
  ArrowLeft,
  Award,
  BarChart3,
  BookOpen,
  Bomb,
  ChevronRight,
  Check,
  Copy,
  Coins,
  Download,
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
  Share2,
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
  POWERUPS,
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
  getBoardClearReward,
  getGamePhase,
  handHasBoardClearPath,
  getPieceBounds,
  getPieceColorIndex,
  getPlacementLines,
  getPlacementReward,
  isBoardEmpty,
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
  ACHIEVEMENTS,
  BOARD_CLEAR_MILESTONES,
  finalizeRunProgress,
  getMissionDefinition,
  getNextBoardClearMilestone,
  getThemeRequirementLabel,
  getThemeUnlockStatus,
} from "./progression/progression.js";
import {
  SKINS,
  getSkin,
  getSkinCssVariables,
} from "./theme/skins.js";
import {
  getBoardGridMetrics,
  getDragLift,
  getPlacementCell,
} from "./game/dragPlacement.js";
import {
  copyResultText,
  createResultShareText,
} from "./share/resultShare.js";

const APP_VERSION = packageMetadata.version;
const APP_LOGO = "/brand/block-rush-logo.webp";

function detectStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

let audioContext;
let audioMaster;
let musicNodes;
let lastVoiceAt = 0;

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

    if (kind === "ui") {
      scheduleTone(context, output, {
        frequency: 620,
        endFrequency: 440,
        start: now,
        duration: 0.045,
        volume: 0.022,
        type: "sine",
      });
      return;
    }

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

    if (kind === "newBest") {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        scheduleTone(context, output, {
          frequency,
          endFrequency: frequency * 1.06,
          start: now + index * 0.065,
          duration: 0.22,
          volume: 0.044,
          type: index % 2 ? "triangle" : "sine",
        });
      });
      scheduleNoise(context, output, {
        start: now + 0.08,
        duration: 0.16,
        volume: 0.018,
        frequency: 4200,
      });
      return;
    }

    if (kind === "boardClear") {
      scheduleTone(context, output, {
        frequency: 104,
        endFrequency: 52,
        start: now,
        duration: 0.3,
        volume: 0.075,
        type: "triangle",
      });
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => {
        scheduleTone(context, output, {
          frequency,
          endFrequency: frequency * 1.12,
          start: now + 0.035 + index * 0.055,
          duration: 0.3,
          volume: index === 4 ? 0.038 : 0.05,
          type: index % 2 ? "triangle" : "sine",
        });
      });
      scheduleNoise(context, output, {
        start: now + 0.04,
        duration: 0.24,
        volume: 0.042,
        frequency: 4100,
      });
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

function speakPraise(label, enabled, intensity = 1, force = false) {
  if (
    !enabled ||
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof window.SpeechSynthesisUtterance !== "function" ||
    document.hidden
  ) {
    return;
  }

  const now = Date.now();
  if (!force && now - lastVoiceAt < 1700) return;
  lastVoiceAt = now;

  try {
    const utterance = new window.SpeechSynthesisUtterance(
      label.charAt(0) + label.slice(1).toLowerCase(),
    );
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => /^en(-|_)(US|GB)/i.test(voice.lang) && voice.localService) ||
      voices.find((voice) => /^en/i.test(voice.lang)) ||
      null;
    utterance.volume = 0.72;
    utterance.rate = intensity >= 4 ? 1.02 : 1.08;
    utterance.pitch = Math.min(1.32, 1.08 + intensity * 0.045);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Voice feedback is optional and varies by browser support.
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
  if (combo >= 3) return "AMAZING";
  if (combo >= 2) return "AWESOME";
  if (lineCount >= 3) return "GREAT";
  if (lineCount >= 2) return "GOOD";
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
  if (!piece || piece.placed) return <span className="empty-piece" aria-hidden="true" />;
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
              ? {
                  "--block-color":
                    skin.swatches[getPieceColorIndex(piece, index) % skin.swatches.length],
                }
              : undefined
          }
        />,
      );
    }
  }

  return (
    <div
      className={`piece-grid ${compact ? "compact" : ""}`}
      data-theme={skin.id}
      data-block-motif={skin.visual.blockMotif}
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
      const axis = Array.isArray(mark) ? "row" : mark.axis;
      return [`${row}-${col}`, { delay: delay || 0, axis }];
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
      data-theme={selectedSkin.id}
      data-board-motif={selectedSkin.visual.boardMotif}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const key = `${rowIndex}-${colIndex}`;
          const previewColorIndex = previewCells.get(key);
          const preview = previewColorIndex !== undefined;
          const clearMark = clearCells.get(key);
          const clearing = clearMark !== undefined;
          const landDelay = landedCells.get(key);
          const landed = landDelay !== undefined;
          const lineReady = previewRows.has(rowIndex) || previewCols.has(colIndex);
          const color = cell
            ? selectedSkin.swatches[cell.colorIndex % selectedSkin.swatches.length]
            : undefined;
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
                clearing ? `clear-${clearMark.axis || "row"}` : "",
                landed ? "landed" : "",
                activePower ? "tool-target" : "",
              ].join(" ")}
              key={key}
              style={{
                ...(color && !preview ? { "--block-color": color } : {}),
                ...(previewColor ? { "--preview-color": previewColor } : {}),
                ...(clearing ? { "--clear-delay": `${clearMark.delay}ms` } : {}),
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

function BoardClearFX({ reward, skin }) {
  const intensity = reward.streak >= 5 ? 4 : reward.streak >= 3 ? 3 : reward.streak >= 2 ? 2 : 1;
  return (
    <div
      className={`board-clear-fx preset-${skin.visual.boardClear.preset} intensity-${intensity}`}
      aria-hidden="true"
    >
      <i className="clear-impact" />
      <i className="clear-ring ring-one" />
      <i className="clear-ring ring-two" />
      <i className="clear-theme-sweep" />
      <div className="clear-fragments">
        {Array.from({ length: 16 + intensity * 3 }, (_, index) => (
          <i
            key={index}
            className={`clear-fragment fragment-${skin.visual.boardClear.fragments}`}
            style={{
              "--fragment-index": index,
              "--fragment-angle": `${(360 / (16 + intensity * 3)) * index}deg`,
              "--fragment-distance": `${92 + (index % 5) * 18}px`,
              "--fragment-delay": `${(index % 6) * 18}ms`,
            }}
          />
        ))}
      </div>
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
  boardClear,
  drag,
  activePower,
  onBeginDrag,
  onCellAction,
  onPause,
  tutorialActive,
}) {
  const skin = getSkin(profile.selectedThemeId);
  const previewCompleted = hover?.valid
    ? getPlacementLines(run.board, hover.piece, hover.row, hover.col, profile.selectedThemeId)
    : { rows: [], cols: [], count: 0 };

  return (
    <main className="game-screen">
      <header className="top-bar">
        <div className="best-chip">
          <Trophy size={14} aria-hidden="true" />
          <span>{profile.bestScore.toLocaleString()}</span>
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
        </div>
      </header>

      <div
        className={[
          "board-wrap",
          boardClear ? "board-clear-active" : "",
          praise?.combo >= 2 ? "combo-impact" : "",
          boardClear ? `clear-${skin.visual.boardClear.preset}` : "",
          boardClear
            ? `clear-intensity-${boardClear.streak >= 5 ? 4 : boardClear.streak >= 3 ? 3 : boardClear.streak >= 2 ? 2 : 1}`
            : "",
        ].join(" ")}
        data-theme={skin.id}
        data-fever-preset={skin.visual.fever.preset}
      >
        <Board
          board={run.board}
          boardRef={boardRef}
          skinId={profile.selectedThemeId}
          hover={hover}
          previewCompleted={previewCompleted}
          clearMarks={clearMarks}
          landingMarks={landingMarks}
          activePower={activePower}
          onCellAction={onCellAction}
        />
        <div className="particles" aria-hidden="true">
          {particles.map((particle) => (
            <i
              key={particle.id}
              className="particle"
              data-preset={particle.preset}
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                "--dx": `${particle.dx}px`,
                "--dy": `${particle.dy}px`,
                "--particle-color": particle.color,
                "--particle-rotation": `${particle.rotation}deg`,
                "--particle-scale": particle.scale,
                "--particle-delay": `${particle.delay}ms`,
                "--particle-duration": `${particle.lifetime}ms`,
                "--particle-gravity": `${particle.gravity}px`,
              }}
            />
          ))}
        </div>
        {boardClear && <BoardClearFX reward={boardClear} skin={skin} />}
        {lastReward && (
          <div
            className="reward-burst"
            style={{ left: `${lastReward.left}%`, top: `${lastReward.top}%` }}
            aria-live="polite"
          >
            <strong>+{lastReward.score}</strong>
          </div>
        )}
        {boardClear && (
          <div
            className={`board-clear-flash preset-${skin.visual.boardClear.preset}`}
            role="status"
            aria-live="assertive"
          >
            <span>Perfect sweep</span>
            <strong>
              BOARD CLEAR{boardClear.streak > 1 ? ` x${boardClear.streak}` : ""}!
            </strong>
            <b>+{boardClear.score.toLocaleString()}</b>
            <em>+{boardClear.coins} coins</em>
          </div>
        )}
      </div>

      <section className="piece-zone" aria-label="Available pieces">
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
              <PiecePreview piece={piece} skinId={profile.selectedThemeId} />
            </button>
          ))}
        </div>
      </section>

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
          <PiecePreview piece={drag.piece} skinId={profile.selectedThemeId} compact />
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

function MainMenu({ run, profile, onPlay, onNewGame, onShop, onMissions, onStats, onSettings }) {
  const hasSavedRun = run.moves > 0 && !run.isOver;
  const visiblePieces = run.pieces.filter((piece) => !piece.placed).slice(0, 3);
  const chestPercent = Math.min(100, (profile.chestProgress / CHEST_MAX) * 100);
  return (
    <main className="menu-screen">
      <div className="menu-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="menu-hero">
        <div className="menu-copy">
          <span className="menu-kicker">
            <Zap size={13} aria-hidden="true" />
            8x8 block puzzle
          </span>
          <h1 className="menu-logo">
            <img src={APP_LOGO} alt="Block Rush" draggable="false" fetchPriority="high" />
          </h1>
          <p>Fit smart. Clear lines. Keep the rush alive.</p>
        </div>
        <div className="menu-block-showcase" aria-hidden="true">
          <span className="showcase-glow" />
          {visiblePieces.map((piece, index) => (
            <div className={`showcase-piece piece-${index + 1}`} key={piece.id}>
              <PiecePreview piece={piece} skinId={profile.selectedThemeId} />
            </div>
          ))}
        </div>
      </section>

      <section className="menu-dashboard">
        <div className="best-score-card">
          <span><Trophy size={15} aria-hidden="true" /> Best score</span>
          <strong>{profile.bestScore.toLocaleString()}</strong>
        </div>
        <div className="menu-resource">
          <span><Coins size={15} aria-hidden="true" /> Coins</span>
          <strong>{profile.totalCoins.toLocaleString()}</strong>
        </div>
        <div className="menu-resource">
          <span><Star size={15} aria-hidden="true" /> Level</span>
          <strong>{profile.level}</strong>
        </div>
      </section>

      <section className="menu-actions">
        <button className="primary-button" type="button" onClick={hasSavedRun ? onPlay : onNewGame}>
          <Play size={20} aria-hidden="true" />
          <span>{hasSavedRun ? "Continue Rush" : "Play Now"}</span>
        </button>
        {hasSavedRun && (
          <button className="new-run-button" type="button" onClick={onNewGame}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Start fresh</span>
          </button>
        )}
      </section>

      <button className="menu-chest-progress" type="button" onClick={onMissions}>
        <span className="menu-chest-icon"><Gift size={20} aria-hidden="true" /></span>
        <span className="menu-chest-copy">
          <strong>{profile.chestProgress >= CHEST_MAX ? "Reward ready" : "Next reward"}</strong>
          <i><b style={{ width: `${chestPercent}%` }} /></i>
        </span>
        <span>{profile.chestProgress}/{CHEST_MAX}</span>
      </button>

      <nav className="menu-grid" aria-label="Main menu">
        <IconButton icon={ShoppingBag} label="Themes" onClick={onShop} />
        <IconButton icon={Target} label="Missions" onClick={onMissions} />
        <IconButton icon={BarChart3} label="Stats" onClick={onStats} />
        <IconButton icon={Settings} label="Settings" onClick={onSettings} />
      </nav>
    </main>
  );
}

function ThemeMiniBoard({ skin, large = false }) {
  const filled = new Set(skin.visual.previewPattern);
  return (
    <div
      className={`theme-mini-board ${large ? "large" : ""}`}
      style={getSkinCssVariables(skin)}
      data-theme={skin.id}
      data-board-motif={skin.visual.boardMotif}
      data-block-motif={skin.visual.blockMotif}
      aria-hidden="true"
    >
      {Array.from({ length: 16 }, (_, index) => (
        <i
          key={index}
          className={filled.has(index) ? "filled" : ""}
          style={
            filled.has(index)
              ? { "--block-color": skin.swatches[index % skin.swatches.length] }
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ShopScreen({ profile, onBack, onBuySkin, onSelectSkin, onBuyPowerup }) {
  const [focusedThemeId, setFocusedThemeId] = useState(profile.selectedThemeId);
  const focusedTheme = getSkin(focusedThemeId);
  const focusedStatus = getThemeUnlockStatus(focusedTheme, profile);
  const focusedEquipped = profile.selectedThemeId === focusedTheme.id;
  const themeOrder = ["classic", "watermelon", "galaxy", "gold", "candy", "neon", "ocean", "sakura", "marble", "rainbow"];
  const orderedThemes = [...SKINS].sort(
    (left, right) => themeOrder.indexOf(left.id) - themeOrder.indexOf(right.id),
  );

  return (
    <main className="panel-screen">
      <ScreenHeader title="Shop" onBack={onBack} meta={`${profile.totalCoins.toLocaleString()} coins`} />
      <section className="theme-focus-card" style={getSkinCssVariables(focusedTheme)}>
        <ThemeMiniBoard skin={focusedTheme} large />
        <div className="theme-focus-copy">
          <span className={`rarity-badge rarity-${focusedTheme.rarity.toLowerCase()}`}>
            {focusedTheme.rarity}
          </span>
          <h2>{focusedTheme.name}</h2>
          <p>{focusedTheme.description}</p>
          <strong>{getThemeRequirementLabel(focusedTheme, profile)}</strong>
          {!focusedStatus.unlocked && (
            <div className="theme-progress">
              <i>
                <b style={{ width: `${Math.min(100, (focusedStatus.progress / focusedStatus.target) * 100)}%` }} />
              </i>
              <span>{focusedTheme.coinPrice.toLocaleString()} coin alternative</span>
            </div>
          )}
        </div>
        {focusedEquipped ? (
          <button className="mini-button done" type="button" disabled>
            <Check size={16} aria-hidden="true" />
            <span>Equipped</span>
          </button>
        ) : focusedStatus.unlocked ? (
          <button className="mini-button" type="button" onClick={() => onSelectSkin(focusedTheme.id)}>
            <Check size={16} aria-hidden="true" />
            <span>Equip</span>
          </button>
        ) : (
          <button
            className="mini-button"
            type="button"
            onClick={() => onBuySkin(focusedTheme.id)}
            disabled={!focusedStatus.requirementMet && !focusedStatus.canBuy}
          >
            {focusedStatus.requirementMet ? <Award size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
            <span>{focusedStatus.requirementMet ? "Unlock" : focusedStatus.canBuy ? "Buy" : "Locked"}</span>
          </button>
        )}
      </section>
      <section className="shop-section">
        <div className="section-heading">
          <h2>Block themes</h2>
          <span>{profile.unlockedThemeIds.length}/{SKINS.length} unlocked</span>
        </div>
        <div className="skin-list">
          {orderedThemes.map((skin) => {
            const status = getThemeUnlockStatus(skin, profile);
            const selected = profile.selectedThemeId === skin.id;
            return (
              <article
                className={`skin-card ${selected ? "selected" : ""} ${status.unlocked ? "" : "locked"}`}
                key={skin.id}
                onClick={() => setFocusedThemeId(skin.id)}
              >
                <ThemeMiniBoard skin={skin} />
                <div>
                  <span className={`rarity-badge rarity-${skin.rarity.toLowerCase()}`}>{skin.rarity}</span>
                  <h3>{skin.name}</h3>
                  <p>{status.unlocked ? "Unlocked" : getThemeRequirementLabel(skin, profile)}</p>
                  {!status.unlocked && <small>or {skin.coinPrice.toLocaleString()} coins</small>}
                </div>
                {selected ? (
                  <button className="mini-button done" type="button" disabled>
                    <Check size={16} aria-hidden="true" />
                    <span>Equipped</span>
                  </button>
                ) : status.unlocked ? (
                  <button
                    className="mini-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectSkin(skin.id);
                    }}
                  >
                    <Check size={16} aria-hidden="true" />
                    <span>Equip</span>
                  </button>
                ) : (
                  <button
                    className="mini-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onBuySkin(skin.id);
                    }}
                    disabled={!status.requirementMet && !status.canBuy}
                  >
                    {status.requirementMet ? <Award size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                    <span>{status.requirementMet ? "Unlock" : status.canBuy ? "Buy" : "Locked"}</span>
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
                disabled={profile.totalCoins < powerup.cost}
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
  const nextMilestone = getNextBoardClearMilestone(profile.totalBoardClears);
  const completedCount = profile.dailyMissionIds.filter((missionId) => {
    const mission = getMissionDefinition(missionId);
    const state = profile.dailyMissionProgress[missionId];
    return mission && state?.progress >= mission.target;
  }).length;
  return (
    <main className="panel-screen missions-screen">
      <ScreenHeader title="Missions" onBack={onBack} meta={`${completedCount}/3 daily`} />
      <section className="mission-overview">
        <div>
          <span className="eyebrow">Daily missions</span>
          <h2>Keep the rush going</h2>
          <p>Complete today’s goals and claim coin rewards.</p>
        </div>
        <strong>{completedCount}/3</strong>
      </section>
      <section className="mission-list">
        {profile.dailyMissionIds.map((missionId) => {
          const mission = getMissionDefinition(missionId);
          const state = profile.dailyMissionProgress[missionId] || { progress: 0, claimed: false };
          const ready = state.progress >= mission.target;
          const status = state.claimed ? "claimed" : ready ? "ready" : "active";
          return (
            <article className={`mission-card ${status}`} key={mission.id}>
              <div className="mission-icon" data-tier={mission.tier}>
                {state.claimed ? <Check size={20} aria-hidden="true" /> : <Target size={20} aria-hidden="true" />}
              </div>
              <div className="mission-body">
                <div className="mission-title-row">
                  <span>{mission.tier}</span>
                  <strong><Coins size={14} aria-hidden="true" /> {mission.reward}</strong>
                </div>
                <h2>{mission.title}</h2>
                <ProgressBar value={Math.min(state.progress, mission.target)} max={mission.target} label="Progress" />
              </div>
              <button
                className="mini-button"
                type="button"
                disabled={!ready || state.claimed}
                onClick={() => onClaim(mission.id)}
              >
                {state.claimed ? <Check size={16} aria-hidden="true" /> : <Coins size={16} aria-hidden="true" />}
                <span>{state.claimed ? "Claimed" : ready ? "Claim" : `${Math.min(state.progress, mission.target)}/${mission.target}`}</span>
              </button>
            </article>
          );
        })}
      </section>

      <section className="milestone-card">
        <div>
          <span className="eyebrow">Board Clear journey</span>
          <h2>Next milestone: {nextMilestone}</h2>
        </div>
        <ProgressBar
          value={Math.min(profile.totalBoardClears, nextMilestone)}
          max={nextMilestone}
          label={`${profile.totalBoardClears} lifetime clears`}
        />
        <div className="milestone-pips" aria-label="Board Clear milestones">
          {BOARD_CLEAR_MILESTONES.map((milestone) => (
            <i className={profile.totalBoardClears >= milestone ? "done" : ""} key={milestone}>
              {milestone}
            </i>
          ))}
        </div>
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

function StatsScreen({ profile, onBack }) {
  const averageScore = profile.totalGamesPlayed
    ? Math.round(profile.lifetimeScore / profile.totalGamesPlayed)
    : 0;
  const hours = Math.floor(profile.totalPlayTime / 3600);
  const minutes = Math.floor((profile.totalPlayTime % 3600) / 60);
  const playTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const favoriteTheme = getSkin(profile.selectedThemeId);
  const stats = [
    [Trophy, "Best Score", profile.bestScore.toLocaleString()],
    [Zap, "Lifetime Score", profile.lifetimeScore.toLocaleString()],
    [Play, "Games Played", profile.totalGamesPlayed.toLocaleString()],
    [Target, "Lines Cleared", profile.totalLinesCleared.toLocaleString()],
    [Star, "Board Clears", profile.totalBoardClears.toLocaleString()],
    [Award, "Best Clear Streak", `x${profile.bestBoardClearStreak}`],
    [Shuffle, "Total Combos", profile.totalCombos.toLocaleString()],
    [Zap, "Best Combo", `x${profile.bestCombo}`],
    [Gift, "Rush Fevers", profile.totalFeverActivations.toLocaleString()],
    [Coins, "Coins Earned", profile.lifetimeCoinsEarned.toLocaleString()],
    [ShoppingBag, "Themes", `${profile.unlockedThemeIds.length}/${SKINS.length}`],
    [BarChart3, "Average Score", averageScore.toLocaleString()],
  ];

  return (
    <main className="panel-screen">
      <ScreenHeader title="Player Stats" onBack={onBack} meta={`${playTime} played`} />
      <section className="stats-highlight">
        <ThemeMiniBoard skin={favoriteTheme} large />
        <div>
          <span className="eyebrow">Equipped theme</span>
          <h2>{favoriteTheme.name}</h2>
          <p>{profile.totalBoardClears} lifetime Board Clears</p>
        </div>
      </section>
      <section className="stats-card-grid">
        {stats.map(([Icon, label, value]) => (
          <article className="stats-card" key={label}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <section className="achievement-section">
        <div className="section-heading">
          <h2>Achievements</h2>
          <span>{profile.achievements.length}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="achievement-grid">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = profile.achievements.includes(achievement.id);
            return (
              <article className={unlocked ? "unlocked" : "locked"} key={achievement.id}>
                <Award size={19} aria-hidden="true" />
                <div>
                  <h3>{achievement.title}</h3>
                  <p>{achievement.description}</p>
                </div>
                {unlocked ? <Check size={16} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function SettingsScreen({
  profile,
  onBack,
  onToggleSetting,
  onReplayTutorial,
  onResetProgress,
  installAvailable,
  installed,
  onInstall,
}) {
  return (
    <main className="panel-screen">
      <ScreenHeader title="Settings" onBack={onBack} meta={`v${APP_VERSION}`} />
      <section className="settings-list">
        <button className="setting-row" type="button" onClick={() => onToggleSetting("sound")}>
          {profile.settings.sound ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
          <span>Sound effects</span>
          <strong>{profile.settings.sound ? "On" : "Off"}</strong>
        </button>
        <button className="setting-row" type="button" onClick={() => onToggleSetting("voice")}>
          <Mic2 size={20} aria-hidden="true" />
          <span>Voice feedback</span>
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
        <button className="setting-row" type="button" onClick={onReplayTutorial}>
          <BookOpen size={20} aria-hidden="true" />
          <span>Replay tutorial</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {installAvailable && (
          <button className="setting-row install" type="button" onClick={onInstall}>
            <Download size={20} aria-hidden="true" />
            <span>Install Block Rush</span>
            <strong>Install</strong>
          </button>
        )}
        <button className="setting-row danger" type="button" onClick={onResetProgress}>
          <RotateCcw size={20} aria-hidden="true" />
          <span>Reset progress</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>
      <footer className="settings-app-info">
        <img src={APP_LOGO} alt="" aria-hidden="true" draggable="false" />
        <div>
          <strong>Block Rush v{APP_VERSION}</strong>
          <span>{installed ? "Installed app" : "Mobile web app"}</span>
        </div>
      </footer>
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

function GameOverScreen({ run, profile, onRestart, onMenu, onShop, onMissions, onShare, onCopy }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const bestBeat = run.score > (run.bestAtStart || 0);
  const motivation = bestBeat ? "New best!" : run.score >= profile.bestScore * 0.85 ? "So close!" : "One more round?";
  const summary = run.resultSummary || {};
  const completedMissions = (summary.newlyCompletedMissions || [])
    .map(getMissionDefinition)
    .filter(Boolean);
  const unlockedAchievements = (summary.unlockedAchievements || [])
    .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter(Boolean);
  const readyThemes = (summary.newlyEligibleThemes || []).map(getSkin);
  const missionGains = Object.entries(summary.missionProgressGained || {})
    .filter(([, gain]) => gain > 0)
    .map(([id, gain]) => ({ mission: getMissionDefinition(id), gain }))
    .filter((item) => item.mission);
  const resultTheme = getSkin(run.themeId || profile.selectedThemeId);
  const completedDailyCount = profile.dailyMissionIds.filter((missionId) => {
    const mission = getMissionDefinition(missionId);
    const state = profile.dailyMissionProgress[missionId];
    return mission && state?.progress >= mission.target;
  }).length;
  const progressHighlightCount =
    completedMissions.length + unlockedAchievements.length + readyThemes.length;
  return (
    <>
      <main className="game-over compact-result">
        <section className="result-hero-card" style={getSkinCssVariables(resultTheme)}>
          <div className="result-topline">
            <div className="result-brand">
              <span>Block</span>
              <strong>Rush</strong>
            </div>
            <div className="result-theme compact">
              <ThemeMiniBoard skin={resultTheme} />
              <span>{resultTheme.name}</span>
            </div>
          </div>
          <span className={`result-label ${bestBeat ? "new-best" : ""}`}>
            {bestBeat ? "New Best!" : "Final Score"}
          </span>
          <h1>{run.score.toLocaleString()}</h1>
          <p className="result-motivation">{motivation}</p>
          <div className="result-quick-grid">
            <div><Trophy size={16} /><span>Best</span><strong>{profile.bestScore.toLocaleString()}</strong></div>
            <div><Coins size={16} /><span>Coins</span><strong>+{run.coinsEarned || 0}</strong></div>
            <div><Award size={16} /><span>Clears</span><strong>{run.boardClears || 0}</strong></div>
            <div><Zap size={16} /><span>Combo</span><strong>x{run.biggestCombo || 0}</strong></div>
          </div>
          <div className="result-streak-line">
            <Star size={15} aria-hidden="true" />
            <span>Best Board Clear streak</span>
            <strong>x{run.bestBoardClearStreak || 0}</strong>
          </div>
        </section>

        <section className="result-progress-compact">
          <div>
            <Target size={18} aria-hidden="true" />
            <span>Daily Missions</span>
            <strong>{completedDailyCount}/3</strong>
          </div>
          {progressHighlightCount > 0 && (
            <div className="result-highlight">
              <Gift size={18} aria-hidden="true" />
              <span>{progressHighlightCount} new reward{progressHighlightCount > 1 ? "s" : ""}</span>
              <strong>Ready</strong>
            </div>
          )}
          <button type="button" onClick={() => setDetailsOpen(true)}>
            <BarChart3 size={17} aria-hidden="true" />
            <span>More Details</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </section>

        <section className="result-actions">
          <button className="primary-button" type="button" onClick={onRestart}>
            <RotateCcw size={20} aria-hidden="true" />
            <span>Play Again</span>
          </button>
          <button className="secondary-button" type="button" onClick={onShare}>
            <Share2 size={18} aria-hidden="true" />
            <span>Share</span>
          </button>
          <button className="secondary-button" type="button" onClick={onMenu}>
            <Home size={18} aria-hidden="true" />
            <span>Main Menu</span>
          </button>
        </section>
      </main>

      {detailsOpen && (
        <div className="modal-layer result-details-layer" role="dialog" aria-modal="true" aria-label="Run details">
          <section className="modal-card result-details-sheet">
            <div className="details-sheet-header">
              <div>
                <span className="eyebrow">Run details</span>
                <h2>Rewards & Progress</h2>
              </div>
              <button className="round-button" type="button" onClick={() => setDetailsOpen(false)} title="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="details-stat-grid">
              <StatPill icon={Zap} label="Lines" value={run.totalLines} />
              <StatPill icon={Gift} label="Rush Fever" value={run.feverActivations || 0} />
              <StatPill icon={Star} label="Clear streak" value={`x${run.bestBoardClearStreak || 0}`} />
              <StatPill icon={Coins} label="Earned" value={`+${run.coinsEarned || 0}`} />
            </div>

            {(missionGains.length > 0 || completedMissions.length > 0) && (
              <section className="details-group">
                <div className="details-group-title">
                  <Target size={17} aria-hidden="true" />
                  <h3>Missions</h3>
                  <button type="button" onClick={onMissions}>View Missions</button>
                </div>
                {completedMissions.map((mission) => (
                  <div key={mission.id}><Check size={15} /><span>{mission.title}</span><strong>+{mission.reward}</strong></div>
                ))}
                {missionGains.slice(0, 3).map(({ mission, gain }) => (
                  <div key={`gain-${mission.id}`}><Target size={15} /><span>{mission.title}</span><strong>+{gain}</strong></div>
                ))}
              </section>
            )}

            {unlockedAchievements.length > 0 && (
              <section className="details-group">
                <div className="details-group-title"><Award size={17} /><h3>Achievements</h3></div>
                {unlockedAchievements.map((achievement) => (
                  <div key={achievement.id}><Award size={15} /><span>{achievement.title}</span><strong>Unlocked</strong></div>
                ))}
              </section>
            )}

            {readyThemes.length > 0 && (
              <section className="details-group">
                <div className="details-group-title">
                  <ShoppingBag size={17} /><h3>Themes</h3>
                  <button type="button" onClick={onShop}>View Shop</button>
                </div>
                {readyThemes.map((theme) => (
                  <div key={theme.id}><ShoppingBag size={15} /><span>{theme.name}</span><strong>Ready</strong></div>
                ))}
              </section>
            )}

            <button className="secondary-button" type="button" onClick={onCopy}>
              <Copy size={18} aria-hidden="true" />
              <span>Copy Result</span>
            </button>
          </section>
        </div>
      )}
    </>
  );
}

const TUTORIAL_STEPS = [
  {
    title: "Drag Blocks",
    text: "Place the 3 blocks onto the board.",
    kind: "drag",
  },
  {
    title: "Clear Lines",
    text: "Fill rows or columns to clear them and score points.",
    kind: "lines",
  },
  {
    title: "Board Clear!",
    text: "Clear the whole board for a huge bonus.",
    kind: "clear",
  },
  {
    title: "Unlock Themes",
    text: "Earn coins, complete missions, and unlock new themes.",
    kind: "themes",
  },
];

function TutorialVisual({ kind, skin }) {
  if (kind === "themes") {
    return (
      <div className="tutorial-themes" aria-hidden="true">
        <ThemeMiniBoard skin={skin} large />
        <Coins size={28} />
        <ShoppingBag size={30} />
      </div>
    );
  }

  return (
    <div className={`tutorial-board tutorial-${kind}`} aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => (
        <i
          key={index}
          className={
            kind === "clear"
              ? index < 3 ? "filled clearing" : ""
              : kind === "lines"
                ? [4, 5, 6, 7, 9, 13].includes(index) ? "filled" : ""
                : [10, 11, 15].includes(index) ? "filled moving" : ""
          }
          style={{ "--tutorial-color": skin.swatches[index % skin.swatches.length] }}
        />
      ))}
      {kind === "drag" && <Hand size={30} />}
    </div>
  );
}

function TutorialModal({ skin, onComplete }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="modal-layer tutorial-layer" role="dialog" aria-modal="true" aria-label="How to play">
      <section className="modal-card tutorial-card">
        <div className="tutorial-top">
          <span>How to play</span>
          <button type="button" onClick={onComplete}>Skip</button>
        </div>
        <TutorialVisual kind={current.kind} skin={skin} />
        <div className="tutorial-copy">
          <span>Step {step + 1} of {TUTORIAL_STEPS.length}</span>
          <h2>{current.title}</h2>
          <p>{current.text}</p>
        </div>
        <div className="tutorial-dots" aria-hidden="true">
          {TUTORIAL_STEPS.map((item, index) => (
            <i className={index === step ? "active" : index < step ? "done" : ""} key={item.title} />
          ))}
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => last ? onComplete() : setStep((value) => value + 1)}
        >
          <span>{last ? "Start Playing" : "Next"}</span>
          {!last && <ChevronRight size={18} aria-hidden="true" />}
        </button>
      </section>
    </div>
  );
}

function ShareModal({ text, onShare, onCopy, onClose }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Share result">
      <section className="modal-card share-modal">
        <button className="round-button close" type="button" onClick={onClose} title="Close">
          <X size={18} aria-hidden="true" />
        </button>
        <Share2 size={34} aria-hidden="true" />
        <h2>Challenge a friend</h2>
        <pre>{text}</pre>
        <button className="primary-button" type="button" onClick={onShare}>
          <Share2 size={18} aria-hidden="true" />
          <span>Share Result</span>
        </button>
        <button className="secondary-button" type="button" onClick={onCopy}>
          <Copy size={18} aria-hidden="true" />
          <span>Copy Result</span>
        </button>
      </section>
    </div>
  );
}

function ResetConfirmModal({ onCancel, onConfirm }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Confirm reset">
      <section className="modal-card reset-modal">
        <RotateCcw size={32} aria-hidden="true" />
        <h2>Reset all progress?</h2>
        <p>This removes scores, coins, themes, missions, achievements, and settings from this device.</p>
        <button className="secondary-button" type="button" onClick={onCancel}>Keep Progress</button>
        <button className="primary-button danger-button" type="button" onClick={onConfirm}>Reset Everything</button>
      </section>
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="splash-screen" aria-label="Loading Block Rush">
      <img className="splash-brand-logo" src={APP_LOGO} alt="Block Rush" draggable="false" />
      <div className="splash-loader"><i /></div>
    </div>
  );
}

function PauseModal({ profile, onResume, onRestart, onMenu, onSettings, onMissions, onShop, onPowerup }) {
  const xpMax = levelThreshold(profile.level);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <section className="modal-card pause-card game-menu-card">
        <h2>Game Menu</h2>
        <div className="menu-progress">
          <StatPill icon={Coins} label="Coins" value={profile.totalCoins.toLocaleString()} />
          <StatPill icon={Star} label="Level" value={profile.level} />
          <StatPill icon={Gift} label="Chest" value={`${profile.chestProgress}/${CHEST_MAX}`} />
        </div>
        <div className="menu-bars">
          <ProgressBar value={profile.xp} max={xpMax} label="XP" />
          <ProgressBar value={profile.chestProgress} max={CHEST_MAX} label="Chest" />
        </div>
        <div className="pause-tools" aria-label="Power-ups">
          <button type="button" onClick={() => onPowerup("hammer")}>
            <Hammer size={18} aria-hidden="true" />
            <span>Hammer</span>
            <strong>{profile.powerups.hammer || 0}</strong>
          </button>
          <button type="button" onClick={() => onPowerup("shuffle")}>
            <Shuffle size={18} aria-hidden="true" />
            <span>Shuffle</span>
            <strong>{profile.powerups.shuffle || 0}</strong>
          </button>
          <button type="button" onClick={() => onPowerup("bomb")}>
            <Bomb size={18} aria-hidden="true" />
            <span>Bomb</span>
            <strong>{profile.powerups.bomb || 0}</strong>
          </button>
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

function ThemeUnlockModal({ theme, onClose }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <section className="modal-card theme-unlock-modal" style={getSkinCssVariables(theme)}>
        <span className={`rarity-badge rarity-${theme.rarity.toLowerCase()}`}>{theme.rarity}</span>
        <ThemeMiniBoard skin={theme} large />
        <span className="eyebrow">Theme unlocked</span>
        <h2>{theme.name}</h2>
        <p>{theme.description}</p>
        <button className="primary-button" type="button" onClick={onClose}>
          <Check size={18} aria-hidden="true" />
          <span>Equip Now</span>
        </button>
        <button className="secondary-button" type="button" onClick={onClose}>
          <span>Continue</span>
        </button>
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
  return (
    <div className="praise-flash simple-praise" aria-live="polite">
      {combo >= 2 && <span>Combo x{combo}</span>}
      <strong>{label}</strong>
    </div>
  );
}

function App() {
  const [profile, setProfile] = useState(() => normalizeProfile(readJson(STORAGE_KEYS.profile)));
  const [run, setRun] = useState(
    () => reviveRunFromStorage(readJson(STORAGE_KEYS.run)) || createRun(Math.random, profile.bestScore, profile),
  );
  const [screen, setScreen] = useState("menu");
  const [returnScreen, setReturnScreen] = useState("menu");
  const [returnPaused, setReturnPaused] = useState(false);
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const [activePower, setActivePower] = useState(null);
  const [clearMarks, setClearMarks] = useState([]);
  const [landingMarks, setLandingMarks] = useState([]);
  const [particles, setParticles] = useState([]);
  const [toast, setToast] = useState("");
  const [praiseFlash, setPraiseFlash] = useState(null);
  const [boardClearFlash, setBoardClearFlash] = useState(null);
  const [lastReward, setLastReward] = useState(null);
  const [chestState, setChestState] = useState(null);
  const [themeUnlockState, setThemeUnlockState] = useState(null);
  const [tutorialIntent, setTutorialIntent] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [paused, setPaused] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [shake, setShake] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [standaloneMode, setStandaloneMode] = useState(detectStandaloneMode);
  const boardRef = useRef(null);
  const toastTimer = useRef(null);
  const rewardTimer = useRef(null);
  const praiseTimer = useRef(null);
  const boardClearTimer = useRef(null);
  const gameOverTimer = useRef(null);
  const landingTimer = useRef(null);
  const hoverRef = useRef(null);
  const lastValidHoverRef = useRef(null);
  const dragFrame = useRef(null);
  const pendingPointer = useRef(null);
  const audioUnlockedRef = useRef(false);

  const selectedSkin = useMemo(() => getSkin(profile.selectedThemeId), [profile.selectedThemeId]);
  const shareText = useMemo(
    () => createResultShareText(run, profile, getSkin(run.themeId || profile.selectedThemeId).name),
    [run, profile.bestScore, profile.selectedThemeId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 620);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const displayMode = window.matchMedia?.("(display-mode: standalone)");
    const updateStandaloneMode = () => setStandaloneMode(detectStandaloneMode());
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      if (window.sessionStorage.getItem("block-rush-install-dismissed") === "1") return;
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setStandaloneMode(true);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode?.addEventListener?.("change", updateStandaloneMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode?.removeEventListener?.("change", updateStandaloneMode);
    };
  }, []);

  useEffect(() => {
    saveJson(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.run, run);
  }, [run]);

  useEffect(() => {
    if (!run.isOver || run.finalized) return;
    const finalized = finalizeRunProgress(profile, run);
    setProfile(finalized.profile);
    setRun(finalized.run);
  }, [run.isOver, run.finalized]);

  useEffect(() => {
    document.documentElement.dataset.skin = selectedSkin.id;
    document.documentElement.style.colorScheme = selectedSkin.tone;
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.append(themeMeta);
    }
    themeMeta.content = selectedSkin.ui.backgroundEnd;
  }, [selectedSkin]);

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

  function addParticles(
    amount,
    origins = [[3.5, 3.5]],
    preset = selectedSkin.visual.particle,
    duration = 760,
  ) {
    const colors = preset.colors || selectedSkin.swatches;
    const nextParticles = Array.from({ length: amount }, (_, index) => ({
      id: `${Date.now()}-${index}`,
      ...(() => {
        const [row, col] = origins[index % origins.length];
        return {
          left: ((col + 0.5) / BOARD_SIZE) * 100 + (Math.random() - 0.5) * 4,
          top: ((row + 0.5) / BOARD_SIZE) * 100 + (Math.random() - 0.5) * 4,
          dx: -78 + Math.random() * 156,
          dy: -105 + Math.random() * 90,
          color: colors[index % colors.length],
          preset: preset.preset,
          rotation: Math.round(Math.random() * 280 - 140),
          scale: (0.68 + Math.random() * 0.82).toFixed(2),
          delay: Math.round(Math.random() * 90),
          lifetime: Math.round(duration * (0.78 + Math.random() * 0.2)),
          gravity: preset.float ? -18 - Math.random() * 28 : 12 + Math.random() * 24,
        };
      })(),
    }));
    setParticles(nextParticles);
    window.setTimeout(() => setParticles([]), duration);
  }

  function flashPraise(label, combo, lineCount) {
    if (!label) return;
    setPraiseFlash({ label, combo });
    window.clearTimeout(praiseTimer.current);
    praiseTimer.current = window.setTimeout(() => setPraiseFlash(null), 900);
    const intensity = Math.max(lineCount, combo);
    if (intensity >= 2) {
      speakPraise(label, profile.settings.voice && audioUnlockedRef.current, intensity);
    }
  }

  function triggerShake(strong = false) {
    setShake(true);
    haptic(profile.settings.haptics, strong ? [28, 30, 28] : 24);
    window.setTimeout(() => setShake(false), strong ? 380 : 260);
  }

  function finalizeRunAfterMove(baseRun, boardAfterClear, piecesAfterPlacement, progressProfile = profile) {
    const refreshedHand = piecesAfterPlacement.every((piece) => piece.placed);
    const generatedPieces = refreshedHand
      ? generateHand(Math.random, Date.now(), {
          board: boardAfterClear,
          moves: baseRun.moves,
          score: baseRun.score,
          totalLines: baseRun.totalLines,
          combo: baseRun.combo,
          comboMisses: baseRun.comboMisses,
          boardClearPity: baseRun.boardClearPity,
          recentShapeIds: baseRun.recentShapeIds,
          previousShapeIds: piecesAfterPlacement.map((piece) => piece.shapeId),
        })
      : piecesAfterPlacement;
    const nextPieces = syncPiecesWithBonus(generatedPieces, baseRun.bonus);
    const offeredBoardClear = refreshedHand && handHasBoardClearPath(boardAfterClear, nextPieces, {
      moves: baseRun.moves,
      score: baseRun.score,
      totalLines: baseRun.totalLines,
    });
    const isOver = !canAnyPieceFit(boardAfterClear, nextPieces);
    let finalRun = {
      ...baseRun,
      board: boardAfterClear,
      pieces: nextPieces,
      recentShapeIds: refreshedHand
        ? [...(baseRun.recentShapeIds || []), ...generatedPieces.map((piece) => piece.shapeId)].slice(-12)
        : baseRun.recentShapeIds,
      boardClearPity: offeredBoardClear ? 0 : baseRun.boardClearPity,
      isOver,
    };
    if (isOver) {
      const finalized = finalizeRunProgress(progressProfile, finalRun);
      finalRun = finalized.run;
      setProfile(finalized.profile);
      playSound(
        finalRun.score > (finalRun.bestAtStart || 0) ? "newBest" : "gameOver",
        profile.settings.sound,
      );
      window.clearTimeout(gameOverTimer.current);
      gameOverTimer.current = window.setTimeout(() => setScreen("gameover"), 520);
    }
    setRun(finalRun);
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

    const placedBoard = placePiece(run.board, piece, row, col, profile.selectedThemeId);
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
    const cleared = completed.count > 0 ? clearCompletedLines(placedBoard, completed) : null;
    const bonusBeforeMove = run.bonus || { active: false, movesLeft: 0, misses: 0 };
    const reward = getPlacementReward(piece.cells.length, completed.count, run.combo, {
      bonusActive: bonusBeforeMove.active,
    });
    const totalLines = run.totalLines + completed.count;
    const comboState = advanceComboState(run.combo, run.comboMisses || 0, completed.count);
    const comboAfterMove = comboState.combo;
    const boardClear = Boolean(cleared && isBoardEmpty(cleared.board));
    const boardClearStreak = (run.boardClears || 0) + (boardClear ? 1 : 0);
    const boardClearReward = boardClear
      ? getBoardClearReward(
          comboAfterMove,
          getGamePhase({
            moves: run.moves + 1,
            score: run.score + reward.score,
            totalLines,
          }),
          boardClearStreak,
        )
      : { score: 0, coins: 0, xp: 0 };
    const score = run.score + reward.score + boardClearReward.score;
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
    const placementCoin = completed.count === 0 && (run.moves + 1) % 6 === 0 ? 1 : 0;
    const earnedCoins = reward.coins + boardClearReward.coins + placementCoin;
    const progress = applyGameProgress(profile, {
      score,
      scoreGain: reward.score + boardClearReward.score,
      coins: earnedCoins,
      xp: reward.xp + boardClearReward.xp,
      previousLines: run.totalLines,
      linesCleared: completed.count,
      comboEvent: completed.count > 0 && reward.nextCombo >= 2 ? 1 : 0,
      bestCombo: comboAfterMove,
      boardClears: boardClear ? 1 : 0,
      boardClearStreak,
      feverActivations: bonusTriggered ? 1 : 0,
    });
    const baseRun = {
      ...run,
      board: placedBoard,
      pieces: piecesAfterPlacement,
      score,
      combo: comboAfterMove,
      biggestCombo: Math.max(run.biggestCombo || 0, comboAfterMove),
      comboMisses: comboState.misses,
      bonus: bonusAfterMove,
      totalLines,
      coinsEarned: (run.coinsEarned || 0) + Math.max(0, progress.profile.totalCoins - profile.totalCoins),
      xpEarned: (run.xpEarned || 0) + reward.xp + boardClearReward.xp,
      moves: run.moves + 1,
      boardClearPity: boardClear ? 0 : (run.boardClearPity || 0) + 1,
      boardClears: boardClearStreak,
      boardClearStreak,
      bestBoardClearStreak: Math.max(run.bestBoardClearStreak || 0, boardClearStreak),
      feverActivations: (run.feverActivations || 0) + (bonusTriggered ? 1 : 0),
      progressEvents: {
        missions: [...new Set([
          ...(run.progressEvents?.missions || []),
          ...progress.newlyCompletedMissions,
        ])],
        achievements: [...new Set([
          ...(run.progressEvents?.achievements || []),
          ...progress.unlockedAchievements.map((achievement) => achievement.id),
        ])],
      },
    };

    setProfile(progress.profile);
    if (progress.xpRewards.levelsGained > 0) {
      notify(`Level ${progress.profile.level}`);
    } else if (progress.unlockedAchievements.length > 0) {
      notify(`Achievement: ${progress.unlockedAchievements[0].title}`);
    } else if (progress.newlyCompletedMissions.length > 0) {
      notify("Daily mission complete");
    }
    if (bonusTriggered) {
      notify(`Rush Bonus x${BONUS_STAGE.scoreMultiplier}`);
      playSound("reward", profile.settings.sound);
    }
    if (profile.chestProgress < CHEST_MAX && progress.profile.chestProgress >= CHEST_MAX) {
      notify("Chest ready");
    }

    const praise = boardClear ? "" : praiseLabel(completed.count, comboAfterMove);
    playSound(
      boardClear
        ? "boardClear"
        : completed.count
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
          axis:
            completed.rows.includes(cellRow) && !completed.cols.includes(cellCol)
              ? "row"
              : completed.cols.includes(cellCol) && !completed.rows.includes(cellRow)
                ? "col"
                : completed.rows.includes(cellRow)
                  ? "row"
                  : "col",
          delay: Math.min(
            completed.rows.includes(cellRow) ? cellCol * 18 : Number.POSITIVE_INFINITY,
            completed.cols.includes(cellCol) ? cellRow * 18 : Number.POSITIVE_INFINITY,
          ),
        })),
      );
      showReward({
        score: reward.score + boardClearReward.score,
        coins: earnedCoins,
        lines: completed.count,
        left: ((rewardCenter.col + 0.5) / BOARD_SIZE) * 100,
        top: ((rewardCenter.row + 0.5) / BOARD_SIZE) * 100,
      });
      addParticles(
        boardClear ? 44 : Math.min(42, 14 + completed.count * 10 + comboAfterMove * 4),
        boardClear ? [[3.5, 3.5]] : cleared.clearedCells,
        boardClear
          ? {
              preset: selectedSkin.visual.boardClear.particlePreset,
              colors: selectedSkin.visual.particle.colors,
            }
          : selectedSkin.visual.particle,
        boardClear ? 1350 : 760,
      );
      if (boardClear) {
        setBoardClearFlash({ ...boardClearReward, streak: boardClearStreak });
        window.clearTimeout(boardClearTimer.current);
        boardClearTimer.current = window.setTimeout(() => setBoardClearFlash(null), 1450);
        window.clearTimeout(praiseTimer.current);
        setPraiseFlash(null);
        speakPraise("BOARD CLEAR!", profile.settings.voice && audioUnlockedRef.current, 6, true);
      } else {
        flashPraise(praise, comboAfterMove, completed.count);
      }
      triggerShake(boardClear || completed.count > 1 || comboAfterMove >= 2);
      window.setTimeout(() => {
        setClearMarks([]);
        finalizeRunAfterMove(baseRun, cleared.board, piecesAfterPlacement, progress.profile);
        setClearing(false);
      }, boardClear ? 1050 : 470);
    } else {
      haptic(profile.settings.haptics, 8);
      addParticles(
        Math.min(7, piece.cells.length + 2),
        piece.cells.map(([cellRow, cellCol]) => [row + cellRow, col + cellCol]),
        {
          preset: "dust",
          colors: selectedSkin.visual.particle.colors,
          float: true,
        },
        380,
      );
      finalizeRunAfterMove(baseRun, placedBoard, piecesAfterPlacement, progress.profile);
    }
    return true;
  }

  function handleBeginDrag(event, piece) {
    unlockAudio();
    if (!event.isPrimary || event.button > 0 || piece.placed || run.isOver || clearing || paused) return;
    event.preventDefault();
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
      lastValidHoverRef.current = nextHover.valid
        ? { ...nextHover, x: event.clientX, y: event.clientY }
        : null;
      setHover(nextHover);
    } else {
      hoverRef.current = null;
      lastValidHoverRef.current = null;
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
      if (nextHover?.valid) {
        lastValidHoverRef.current = { ...nextHover, x: point.x, y: point.y };
      }
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

    function finishDrag(shouldPlace, releasePoint) {
      if (dragFrame.current) window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
      pendingPointer.current = null;
      const fallback = lastValidHoverRef.current;
      const fallbackDistance = fallback && releasePoint
        ? Math.hypot(releasePoint.x - fallback.x, releasePoint.y - fallback.y)
        : Number.POSITIVE_INFINITY;
      const target = hoverRef.current?.valid
        ? hoverRef.current
        : fallbackDistance <= drag.cellSize * 0.95
          ? fallback
          : hoverRef.current;
      if (shouldPlace && target?.valid) {
        handlePlacePiece(drag.pieceId, target.row, target.col);
      } else if (shouldPlace && target && !target.valid) {
        playSound("bad", profile.settings.sound);
        haptic(profile.settings.haptics, 10);
      }
      setDrag(null);
      setHover(null);
      hoverRef.current = null;
      lastValidHoverRef.current = null;
    }

    function onUp(event) {
      if (event.pointerId !== drag.pointerId) return;
      const releasePoint = { x: event.clientX, y: event.clientY };
      updatePointer(releasePoint);
      finishDrag(true, releasePoint);
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
    const nextRun = {
      ...createRun(Math.random, profile.bestScore, profile),
      themeId: profile.selectedThemeId,
    };
    window.clearTimeout(gameOverTimer.current);
    setRun(nextRun);
    setPaused(false);
    setActivePower(null);
    setScreen("game");
  }

  function requestPlay(fresh = false) {
    unlockAudio();
    if (!profile.tutorialCompleted) {
      setTutorialIntent(fresh ? "new" : "continue");
      return;
    }
    if (fresh) startNewGame();
    else setScreen("game");
  }

  function completeTutorial() {
    setProfile((current) => ({
      ...current,
      tutorialCompleted: true,
      tutorialSeen: true,
    }));
    const intent = tutorialIntent;
    setTutorialIntent(null);
    if (intent === "new") startNewGame();
    if (intent === "continue") setScreen("game");
  }

  function replayTutorial() {
    setTutorialIntent("replay");
  }

  function openSettingsScreen(from) {
    setReturnScreen(from);
    setReturnPaused(false);
    setConfirmReset(false);
    setScreen("settings");
  }

  function backFromPanel() {
    setScreen(returnScreen);
    if (returnScreen === "game" && returnPaused) setPaused(true);
    setReturnPaused(false);
  }

  function handlePowerup(powerupId) {
    unlockAudio();
    if (run.isOver || clearing) return;
    if ((profile.powerups[powerupId] || 0) <= 0) {
      notify("Get more in shop");
      setScreen("shop");
      setReturnScreen("game");
      setReturnPaused(false);
      return;
    }

    if (powerupId === "shuffle") {
      const spent = spendPowerup(profile, "shuffle");
      const fresh = generateHand(Math.random, Date.now(), {
        board: run.board,
        moves: run.moves,
        score: run.score,
        totalLines: run.totalLines,
        combo: run.combo,
        comboMisses: run.comboMisses,
        boardClearPity: run.boardClearPity,
        recentShapeIds: run.recentShapeIds,
        previousShapeIds: run.pieces.filter((piece) => !piece.placed).map((piece) => piece.shapeId),
      });
      let nextIndex = 0;
      const pieces = syncPiecesWithBonus(run.pieces.map((piece) => {
        if (piece.placed) return piece;
        const nextPiece = fresh[nextIndex] || fresh[0];
        nextIndex += 1;
        return nextPiece;
      }), run.bonus);
      let nextRun = {
        ...run,
        pieces,
        recentShapeIds: [...(run.recentShapeIds || []), ...fresh.map((piece) => piece.shapeId)].slice(-12),
        isOver: !canAnyPieceFit(run.board, pieces),
      };
      let nextProfile = spent.profile;
      if (nextRun.isOver) {
        const finalized = finalizeRunProgress(nextProfile, nextRun);
        nextProfile = finalized.profile;
        nextRun = finalized.run;
      }
      setProfile(nextProfile);
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
      scoreGain,
      coins: Math.floor(scoreGain / 80),
      xp: Math.max(3, result.removed * 4),
      previousLines: run.totalLines,
      linesCleared: 0,
      comboEvent: 0,
    });
    const isOver = !canAnyPieceFit(result.board, run.pieces);
    let nextRun = {
      ...run,
      board: result.board,
      score,
      coinsEarned: (run.coinsEarned || 0) + Math.max(0, progress.profile.totalCoins - spent.profile.totalCoins),
      xpEarned: (run.xpEarned || 0) + Math.max(3, result.removed * 4),
      isOver,
      progressEvents: {
        missions: [...new Set([
          ...(run.progressEvents?.missions || []),
          ...progress.newlyCompletedMissions,
        ])],
        achievements: [...new Set([
          ...(run.progressEvents?.achievements || []),
          ...progress.unlockedAchievements.map((achievement) => achievement.id),
        ])],
      },
    };
    let nextProfile = progress.profile;
    if (isOver) {
      const finalized = finalizeRunProgress(nextProfile, nextRun);
      nextProfile = finalized.profile;
      nextRun = finalized.run;
    }
    setProfile(nextProfile);
    setRun(nextRun);
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
    notify(
      result.unlockedAchievements?.length
        ? `Achievement: ${result.unlockedAchievements[0].title}`
        : `+${result.reward} coins`,
    );
  }

  function handleBuySkin(skinId) {
    unlockAudio();
    const result = buySkin(profile, skinId);
    if (!result.purchased) {
      notify(result.reason === "locked" ? "Requirement or coins needed" : "Theme unavailable");
      return;
    }
    setProfile(result.profile);
    setThemeUnlockState(getSkin(skinId));
    playSound("reward", profile.settings.sound);
    notify(result.cost > 0 ? `Theme unlocked · -${result.cost}` : "Theme unlocked by progress");
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

  function handleGlobalButtonClick(event) {
    const button = event.target.closest("button");
    if (!button || button.disabled || button.classList.contains("piece-slot") || button.classList.contains("board-cell")) {
      return;
    }
    unlockAudio();
    playSound("ui", profile.settings.sound);
    haptic(profile.settings.haptics, 5);
  }

  async function handleCopyResult() {
    const copied = await copyResultText(shareText);
    notify(copied ? "Result copied!" : "Could not copy result");
    if (copied) haptic(profile.settings.haptics, 8);
    return copied;
  }

  async function handleShareResult() {
    if (!navigator.share) {
      await handleCopyResult();
      return;
    }
    try {
      await navigator.share({
        title: "Block Rush",
        text: shareText,
        url: window.location.href,
      });
    } catch (error) {
      if (error?.name !== "AbortError") await handleCopyResult();
    }
  }

  async function handleInstallApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice?.outcome !== "accepted") {
      window.sessionStorage.setItem("block-rush-install-dismissed", "1");
    }
  }

  function confirmResetProgress() {
    const nextProfile = createInitialProfile();
    const nextRun = createRun(Math.random, nextProfile.bestScore, nextProfile);
    setProfile(nextProfile);
    setRun(nextRun);
    setScreen("menu");
    setConfirmReset(false);
    window.localStorage.removeItem(STORAGE_KEYS.profile);
    window.localStorage.removeItem(STORAGE_KEYS.run);
    notify("Progress reset");
  }

  const shellStyle = getSkinCssVariables(selectedSkin);

  if (showSplash) return <SplashScreen />;

  return (
    <div
      className={`app-shell ${shake ? "shake" : ""} ${run.bonus?.active ? "rush-active" : ""}`}
      style={shellStyle}
      data-skin={selectedSkin.id}
      data-tone={selectedSkin.tone}
      data-standalone={standaloneMode ? "true" : "false"}
      onClickCapture={handleGlobalButtonClick}
    >
      <div className="phone-frame">
        {screen === "menu" && (
          <MainMenu
            run={run}
            profile={profile}
            onPlay={() => requestPlay(false)}
            onNewGame={() => requestPlay(true)}
            onShop={() => {
              setReturnScreen("menu");
              setReturnPaused(false);
              setScreen("shop");
            }}
            onMissions={() => {
              setReturnScreen("menu");
              setReturnPaused(false);
              setScreen("missions");
            }}
            onStats={() => {
              setReturnScreen("menu");
              setReturnPaused(false);
              setScreen("stats");
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
            boardClear={boardClearFlash}
            drag={drag}
            activePower={activePower}
            onBeginDrag={handleBeginDrag}
            onCellAction={handleCellAction}
            onPause={() => setPaused(true)}
            tutorialActive={false}
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
        {screen === "stats" && (
          <StatsScreen
            profile={profile}
            onBack={backFromPanel}
          />
        )}
        {screen === "settings" && (
          <SettingsScreen
            profile={profile}
            onBack={backFromPanel}
            onToggleSetting={toggleSetting}
            onReplayTutorial={replayTutorial}
            onResetProgress={() => setConfirmReset(true)}
            installAvailable={Boolean(installPrompt) && !standaloneMode}
            installed={standaloneMode}
            onInstall={handleInstallApp}
          />
        )}
        {screen === "gameover" && (
          <GameOverScreen
            run={run}
            profile={profile}
            onRestart={() => requestPlay(true)}
            onMenu={() => setScreen("menu")}
            onShop={() => {
              setReturnScreen("gameover");
              setReturnPaused(false);
              setScreen("shop");
            }}
            onMissions={() => {
              setReturnScreen("gameover");
              setReturnPaused(false);
              setScreen("missions");
            }}
            onShare={() => setShareOpen(true)}
            onCopy={handleCopyResult}
          />
        )}
      </div>

      {paused && (
        <PauseModal
          profile={profile}
          onResume={() => setPaused(false)}
          onRestart={() => {
            setPaused(false);
            requestPlay(true);
          }}
          onMissions={() => {
            setPaused(false);
            setReturnScreen("game");
            setReturnPaused(true);
            setScreen("missions");
          }}
          onShop={() => {
            setPaused(false);
            setReturnScreen("game");
            setReturnPaused(true);
            setScreen("shop");
          }}
          onMenu={() => {
            setPaused(false);
            setScreen("menu");
          }}
          onSettings={() => {
            setPaused(false);
            setReturnScreen("game");
            setReturnPaused(true);
            setConfirmReset(false);
            setScreen("settings");
          }}
          onPowerup={(powerupId) => {
            setPaused(false);
            handlePowerup(powerupId);
          }}
        />
      )}
      {chestState && <ChestModal state={chestState} onOpen={handleChestReward} onClose={() => setChestState(null)} />}
      {themeUnlockState && (
        <ThemeUnlockModal
          theme={themeUnlockState}
          onClose={() => setThemeUnlockState(null)}
        />
      )}
      {tutorialIntent && (
        <TutorialModal
          skin={selectedSkin}
          onComplete={completeTutorial}
        />
      )}
      {shareOpen && (
        <ShareModal
          text={shareText}
          onShare={handleShareResult}
          onCopy={handleCopyResult}
          onClose={() => setShareOpen(false)}
        />
      )}
      {confirmReset && (
        <ResetConfirmModal
          onCancel={() => setConfirmReset(false)}
          onConfirm={confirmResetProgress}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

export default App;

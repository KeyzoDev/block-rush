import { BOARD_SIZE, getPieceBounds } from "./gameLogic.js";

const EDGE_TOLERANCE_CELLS = 0.8;
const EDGE_ASSIST_CELLS = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getBoardGridMetrics(boardElement) {
  if (!boardElement) return null;

  const rect = boardElement.getBoundingClientRect();
  const style = window.getComputedStyle(boardElement);
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  const width = rect.width - borderLeft - borderRight - paddingLeft - paddingRight;
  const height = rect.height - borderTop - borderBottom - paddingTop - paddingBottom;

  return {
    left: rect.left + borderLeft + paddingLeft,
    top: rect.top + borderTop + paddingTop,
    width,
    height,
    cellWidth: width / BOARD_SIZE,
    cellHeight: height / BOARD_SIZE,
  };
}

export function getPlacementCell(piece, point, metrics) {
  if (!piece || !metrics) return null;

  const toleranceX = metrics.cellWidth * EDGE_TOLERANCE_CELLS;
  const toleranceY = metrics.cellHeight * EDGE_TOLERANCE_CELLS;
  const right = metrics.left + metrics.width;
  const bottom = metrics.top + metrics.height;

  if (
    point.x < metrics.left - toleranceX ||
    point.x > right + toleranceX ||
    point.y < metrics.top - toleranceY ||
    point.y > bottom + toleranceY
  ) {
    return null;
  }

  const bounds = getPieceBounds(piece);
  const rawRow = Math.round((point.y - metrics.top) / metrics.cellHeight - bounds.height / 2);
  const rawCol = Math.round((point.x - metrics.left) / metrics.cellWidth - bounds.width / 2);
  const maxRow = BOARD_SIZE - bounds.height;
  const maxCol = BOARD_SIZE - bounds.width;
  const row =
    rawRow >= -EDGE_ASSIST_CELLS && rawRow <= maxRow + EDGE_ASSIST_CELLS
      ? clamp(rawRow, 0, maxRow)
      : rawRow;
  const col =
    rawCol >= -EDGE_ASSIST_CELLS && rawCol <= maxCol + EDGE_ASSIST_CELLS
      ? clamp(rawCol, 0, maxCol)
      : rawCol;

  return { row, col };
}

export function getDragLift(cellSize) {
  return Math.round(clamp(cellSize * 2, 68, 88));
}

/**
 * Convert a client-space pointer position to a cell in a rectangular grid.
 * The rectangle must describe the visible grid itself, excluding board borders
 * and padding.
 */
export function clientPointToGridCell(rect, clientX, clientY, rows, columns) {
  if (!rect || rect.width <= 0 || rect.height <= 0 || rows <= 0 || columns <= 0) {
    return null;
  }

  const relativeX = clientX - rect.left;
  const relativeY = clientY - rect.top;

  if (relativeX < 0 || relativeX >= rect.width || relativeY < 0 || relativeY >= rect.height) {
    return null;
  }

  return {
    r: Math.min(rows - 1, Math.floor((relativeY / rect.height) * rows)),
    c: Math.min(columns - 1, Math.floor((relativeX / rect.width) * columns)),
  };
}

export function isClientPointInsideRect(rect, clientX, clientY) {
  if (!rect) return false;

  return (
    clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom
  );
}

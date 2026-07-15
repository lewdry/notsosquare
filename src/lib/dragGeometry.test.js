import { describe, expect, it } from "vitest";
import { clientPointToGridCell, isClientPointInsideRect } from "./dragGeometry.js";

const rect = {
  left: 100,
  top: 50,
  right: 350,
  bottom: 350,
  width: 250,
  height: 300,
};

describe("drag geometry", () => {
  it("maps client positions to cells using the grid dimensions", () => {
    expect(clientPointToGridCell(rect, 100, 50, 6, 5)).toEqual({ r: 0, c: 0 });
    expect(clientPointToGridCell(rect, 349.9, 349.9, 6, 5)).toEqual({ r: 5, c: 4 });
    expect(clientPointToGridCell(rect, 225, 175, 6, 5)).toEqual({ r: 2, c: 2 });
  });

  it("rejects points outside the visible grid", () => {
    expect(clientPointToGridCell(rect, 99.9, 100, 6, 5)).toBeNull();
    expect(clientPointToGridCell(rect, 350, 100, 6, 5)).toBeNull();
    expect(clientPointToGridCell(rect, 200, 350, 6, 5)).toBeNull();
    expect(clientPointToGridCell(null, 200, 100, 6, 5)).toBeNull();
  });

  it("uses exclusive right and bottom boundaries for drop detection", () => {
    expect(isClientPointInsideRect(rect, 100, 50)).toBe(true);
    expect(isClientPointInsideRect(rect, 349.9, 349.9)).toBe(true);
    expect(isClientPointInsideRect(rect, 350, 350)).toBe(false);
  });
});

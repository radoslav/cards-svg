import { describe, expect, test } from "bun:test";
import { isPipRank, PIP_LAYOUTS, PIP_RANKS, pipCount } from "./pips.ts";

const layouts: readonly [string, readonly { fx: number; fy: number }[]][] =
  PIP_RANKS.map((rank) => [rank, PIP_LAYOUTS[rank]]);

describe("pip ranks", () => {
  test("covers 2 through 10 and nothing else", () => {
    expect([...PIP_RANKS]).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    expect(isPipRank("7")).toBe(true);
    expect(isPipRank("A")).toBe(false);
    expect(isPipRank("K")).toBe(false);
    expect(isPipRank("Q")).toBe(false);
    expect(isPipRank("J")).toBe(false);
  });

  test("has a pattern for every pip rank", () => {
    for (const rank of PIP_RANKS) {
      expect(PIP_LAYOUTS[rank].length).toBeGreaterThan(0);
    }
  });
});

describe("pip patterns", () => {
  test("draws exactly as many pips as the rank", () => {
    for (const [rank, slots] of layouts) {
      expect(slots).toHaveLength(Number(rank));
      expect(pipCount(rank as (typeof PIP_RANKS)[number])).toBe(Number(rank));
    }
  });

  test("keeps every pip inside the field", () => {
    for (const [, slots] of layouts) {
      for (const slot of slots) {
        expect(slot.fx).toBeGreaterThan(0);
        expect(slot.fx).toBeLessThan(1);
        expect(slot.fy).toBeGreaterThan(0);
        expect(slot.fy).toBeLessThan(1);
      }
    }
  });

  test("never places two pips in the same spot", () => {
    for (const [rank, slots] of layouts) {
      const keys = new Set(slots.map((s) => `${s.fx}:${s.fy}`));
      expect(keys.size, rank).toBe(slots.length);
    }
  });

  test("is symmetric about the vertical center line", () => {
    for (const [rank, slots] of layouts) {
      for (const slot of slots) {
        const mirror = slots.some(
          (other) =>
            Math.abs(other.fx - (1 - slot.fx)) < 1e-9 &&
            Math.abs(other.fy - slot.fy) < 1e-9,
        );
        expect(mirror, `${rank} pip at ${slot.fx},${slot.fy}`).toBe(true);
      }
    }
  });

  test("has at most one pip without a horizontal mirror", () => {
    for (const [rank, slots] of layouts) {
      const mirrored = (slot: { fx: number; fy: number }): boolean =>
        slots.some(
          (other) =>
            Math.abs(other.fy - (1 - slot.fy)) < 1e-9 &&
            Math.abs(other.fx - slot.fx) < 1e-9,
        );
      const unmirrored = slots.filter((slot) => !mirrored(slot));
      expect(unmirrored.length, rank).toBeLessThanOrEqual(1);
    }
  });

  test("puts the unmirrored pip of the seven in the upper half", () => {
    // A card is read from both ends, so the extra pip of an odd pattern sits
    // above the middle: from the other side it appears below it.
    const seven = PIP_LAYOUTS["7"];
    const unmirrored = seven.filter(
      (slot) =>
        !seven.some(
          (other) =>
            Math.abs(other.fy - (1 - slot.fy)) < 1e-9 &&
            Math.abs(other.fx - slot.fx) < 1e-9,
        ),
    );
    expect(unmirrored).toHaveLength(1);
    expect(unmirrored[0]!.fy).toBeLessThan(1 / 2);
  });

  test("is sorted top to bottom, left to right", () => {
    for (const [, slots] of layouts) {
      const keys = slots.map((s) => s.fy * 10 + s.fx);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });

  test("matches the traditional patterns", () => {
    const columns = (rank: string): string[] =>
      PIP_LAYOUTS[rank as (typeof PIP_RANKS)[number]].map((slot) =>
        slot.fx === 0.5 ? "C" : slot.fx < 0.5 ? "L" : "R",
      );
    expect(columns("2")).toEqual(["C", "C"]);
    expect(columns("3")).toEqual(["C", "C", "C"]);
    expect(columns("4")).toEqual(["L", "R", "L", "R"]);
    expect(columns("5")).toEqual(["L", "R", "C", "L", "R"]);
    expect(columns("6")).toEqual(["L", "R", "L", "R", "L", "R"]);
    expect(columns("8")).toEqual(["L", "R", "C", "L", "R", "C", "L", "R"]);
    expect(columns("10")).toEqual([
      "L",
      "R",
      "C",
      "L",
      "R",
      "L",
      "R",
      "C",
      "L",
      "R",
    ]);
  });
});

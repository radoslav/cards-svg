import { describe, expect, test } from "bun:test";
import {
  cardGeometry,
  COLUMN_FRACTIONS,
  UNITS_PER_MM,
  type CardGeometry,
} from "./layout.ts";
import { DECKS } from "./decks.ts";
import { GLYPHS, glyphById } from "./glyphs.ts";
import { PIP_LAYOUTS, PIP_RANKS, type PipSlot } from "./pips.ts";
import { SUIT_ORDER } from "./suits.ts";

const bridge = cardGeometry(DECKS.bridge.size);
const poker = cardGeometry(DECKS.poker.size);
const decks: readonly [string, CardGeometry][] = [
  ["bridge", bridge],
  ["poker", poker],
];

describe("card size", () => {
  test("bridge is 57 x 89 mm at 10 units per mm", () => {
    expect(UNITS_PER_MM).toBe(10);
    expect(bridge.width).toBe(570);
    expect(bridge.height).toBe(890);
  });

  test("poker is 63 x 88 mm", () => {
    expect(poker.width).toBe(630);
    expect(poker.height).toBe(880);
  });
});

describe("columns", () => {
  test("are 20% / 60% / 20% of the card width", () => {
    expect([...COLUMN_FRACTIONS]).toEqual([0.2, 0.6, 0.2]);
    for (const [, geo] of decks) {
      expect(geo.columnWidths[0]).toBeCloseTo(0.2 * geo.width, 6);
      expect(geo.columnWidths[1]).toBeCloseTo(0.6 * geo.width, 6);
      expect(geo.columnWidths[2]).toBeCloseTo(0.2 * geo.width, 6);
    }
  });

  test("tile the card exactly", () => {
    for (const [, geo] of decks) {
      const [a, b, c] = geo.columnWidths;
      expect(a + b + c).toBeCloseTo(geo.width, 6);
      expect(geo.columnLefts[2] + geo.columnWidths[2]).toBeCloseTo(
        geo.width,
        6,
      );
    }
  });

  test("centers sit in the middle of their own column", () => {
    for (const [, geo] of decks) {
      geo.columnLefts.forEach((left, index) => {
        const center = geo.columnCenters[index]!;
        const width = geo.columnWidths[index]!;
        expect(center).toBeCloseTo(left + width / 2, 6);
      });
      expect(geo.columnCenters[1]).toBeCloseTo(geo.width / 2, 6);
    }
  });
});

describe("middle column frame", () => {
  test("sits 20% in from every edge of the card", () => {
    for (const [, geo] of decks) {
      expect(geo.frameLeft).toBeCloseTo(0.2 * geo.width, 6);
      expect(geo.frameRight).toBeCloseTo(0.8 * geo.width, 6);
      expect(geo.frameTop).toBeCloseTo(0.2 * geo.height, 6);
      expect(geo.frameBottom).toBeCloseTo(0.8 * geo.height, 6);
    }
  });

  test("outer bounds coincide with the middle column", () => {
    for (const [, geo] of decks) {
      expect(geo.frameLeft).toBeCloseTo(geo.columnLefts[1], 6);
      expect(geo.frameRight).toBeCloseTo(
        geo.columnLefts[1] + geo.columnWidths[1],
        6,
      );
    }
  });

  test("the frame path is exactly the middle column outline", () => {
    for (const [, geo] of decks) {
      expect(geo.frameX).toBeCloseTo(geo.frameLeft, 6);
      expect(geo.frameY).toBeCloseTo(geo.frameTop, 6);
      expect(geo.frameX + geo.frameWidth).toBeCloseTo(geo.frameRight, 6);
      expect(geo.frameY + geo.frameHeight).toBeCloseTo(geo.frameBottom, 6);
    }
  });

  test("is centered on the card", () => {
    for (const [, geo] of decks) {
      expect(geo.frameX + geo.frameWidth / 2).toBeCloseTo(geo.width / 2, 6);
      expect(geo.frameY + geo.frameHeight / 2).toBeCloseTo(geo.height / 2, 6);
    }
  });
});

describe("pips", () => {
  test("center pip is at the card center", () => {
    for (const [, geo] of decks) {
      expect(geo.centerPipCenter.x).toBeCloseTo(geo.width / 2, 6);
      expect(geo.centerPipCenter.y).toBeCloseTo(geo.height / 2, 6);
    }
  });

  test("corner pips are symmetric about the card center", () => {
    for (const [, geo] of decks) {
      const pips = geo.cornerPipCenters;
      expect(pips).toHaveLength(4);
      const mirror = (a: number, b: number): void => {
        expect(pips[a]!.x).toBeCloseTo(geo.width - pips[b]!.x, 6);
        expect(pips[a]!.y).toBeCloseTo(geo.height - pips[b]!.y, 6);
      };
      mirror(0, 3);
      mirror(1, 2);
    }
  });

  test("only the bottom pair is rotated", () => {
    for (const [, geo] of decks) {
      expect(geo.cornerPipCenters.map((pip) => pip.rotated)).toEqual([
        false,
        false,
        true,
        true,
      ]);
    }
  });

  test("fit inside the frame, including the stroke", () => {
    for (const [, geo] of decks) {
      const half = geo.cornerPipHeight / 2;
      const innerLeft = geo.frameX + geo.frameStrokeWidth / 2;
      const innerRight = geo.frameX + geo.frameWidth - geo.frameStrokeWidth / 2;
      const innerTop = geo.frameY + geo.frameStrokeWidth / 2;
      const innerBottom =
        geo.frameY + geo.frameHeight - geo.frameStrokeWidth / 2;
      for (const pip of geo.cornerPipCenters) {
        expect(pip.x - half).toBeGreaterThan(innerLeft);
        expect(pip.x + half).toBeLessThan(innerRight);
        expect(pip.y - half).toBeGreaterThan(innerTop);
        expect(pip.y + half).toBeLessThan(innerBottom);
      }
      expect(geo.centerPipHeight).toBeLessThan(
        geo.frameHeight - geo.frameStrokeWidth,
      );
    }
  });
});

describe("one suit height", () => {
  test("is shared by the index, the corner pips and the pattern", () => {
    for (const [, geo] of decks) {
      expect(geo.pipHeight).toBe(geo.indexSuitHeight);
      expect(geo.cornerPipHeight).toBe(geo.indexSuitHeight);
      // The index letter matches the suit under it.
      expect(geo.indexRankHeight).toBe(geo.indexSuitHeight);
      // Fixed, so the same suit is the same size on a bridge and a poker card.
      expect(bridge.indexSuitHeight).toBe(poker.indexSuitHeight);
      // Large enough to read, and smaller than the single large pip.
      expect(geo.indexSuitHeight).toBe(7 * UNITS_PER_MM);
      expect(geo.indexSuitHeight).toBeLessThan(geo.centerPipHeight);
    }
  });

  test("leaves a gap in the densest patterns", () => {
    // The tightest pairs are the odd pips of ranks 7, 9 and 10, which sit half a
    // column step away from a side column. Boxes are taken from the widest suit,
    // so every other color has at least as much clear space.
    const widest = Math.max(
      ...SUIT_ORDER.map((suit) => GLYPHS[suit].width / GLYPHS[suit].height),
    );
    const box = (geo: CardGeometry, slot: PipSlot) => {
      const halfWidth = (geo.pipHeight * widest) / 2;
      const halfHeight = geo.pipHeight / 2;
      const x = geo.pipFieldLeft + slot.fx * geo.pipFieldWidth;
      const y = geo.pipFieldTop + slot.fy * geo.pipFieldHeight;
      return {
        left: x - halfWidth,
        right: x + halfWidth,
        top: y - halfHeight,
        bottom: y + halfHeight,
      };
    };
    for (const [, geo] of decks) {
      for (const rank of PIP_RANKS) {
        const boxes = PIP_LAYOUTS[rank].map((slot) => box(geo, slot));
        for (const [index, one] of boxes.entries()) {
          for (const other of boxes.slice(index + 1)) {
            const dx = Math.max(
              one.left - other.right,
              other.left - one.right,
              0,
            );
            const dy = Math.max(
              one.top - other.bottom,
              other.top - one.bottom,
              0,
            );
            expect(Math.hypot(dx, dy)).toBeGreaterThan(0);
          }
          // And every pip stays clear of the frame.
          expect(one.left).toBeGreaterThan(geo.pipFieldLeft);
          expect(one.right).toBeLessThan(geo.pipFieldLeft + geo.pipFieldWidth);
          expect(one.top).toBeGreaterThan(geo.pipFieldTop);
          expect(one.bottom).toBeLessThan(geo.pipFieldTop + geo.pipFieldHeight);
        }
      }
    }
  });
});

describe("index block", () => {
  test("pip field is the frame interior", () => {
    for (const [, geo] of decks) {
      expect(geo.pipFieldLeft).toBeCloseTo(
        geo.frameLeft + geo.frameStrokeWidth / 2,
        6,
      );
      expect(geo.pipFieldTop).toBeCloseTo(
        geo.frameTop + geo.frameStrokeWidth / 2,
        6,
      );
      expect(geo.pipFieldWidth).toBeCloseTo(
        geo.frameWidth - geo.frameStrokeWidth,
        6,
      );
      expect(geo.pipFieldHeight).toBeCloseTo(
        geo.frameHeight - geo.frameStrokeWidth,
        6,
      );
      // The field is centered on the card, like the frame itself.
      expect(geo.pipFieldLeft + geo.pipFieldWidth / 2).toBeCloseTo(
        geo.width / 2,
        6,
      );
      expect(geo.pipFieldTop + geo.pipFieldHeight / 2).toBeCloseTo(
        geo.height / 2,
        6,
      );
    }
  });

  test("stacks rank above suit at equal heights", () => {
    for (const [, geo] of decks) {
      expect(geo.indexSuitHeight).toBe(geo.indexRankHeight);
      expect(geo.indexHeight).toBeCloseTo(
        geo.indexRankHeight + geo.indexGap + geo.indexSuitHeight,
        6,
      );
      expect(geo.indexCenterY).toBeCloseTo(
        geo.indexTop + geo.indexHeight / 2,
        6,
      );
    }
  });

  test("is centered in the visible band below the frame stroke", () => {
    for (const [, geo] of decks) {
      const visibleTop = geo.frameTop - geo.frameStrokeWidth / 2;
      expect(geo.indexCenterY).toBeCloseTo(visibleTop / 2, 6);
      expect(geo.indexTop).toBeGreaterThan(0);
      expect(geo.indexTop).toBeCloseTo(visibleTop - geo.indexBottom, 6);
    }
  });

  test("clears the frame stroke", () => {
    for (const [, geo] of decks) {
      expect(geo.indexBottom).toBeLessThan(
        geo.frameTop - geo.frameStrokeWidth / 2,
      );
      expect(geo.indexTop).toBeGreaterThan(0);
    }
  });

  test("fits inside the first column for every suit and rank", () => {
    for (const [, geo] of decks) {
      for (const suit of SUIT_ORDER) {
        const glyph = glyphById(suit);
        if (!glyph) {
          throw new Error(`missing glyph ${suit}`);
        }
        const suitWidth = (glyph.width / glyph.height) * geo.indexSuitHeight;
        expect(suitWidth).toBeLessThan(geo.columnWidths[0]);
      }
    }
  });

  test("widest rank still fits the index column", () => {
    for (const [, geo] of decks) {
      const rank = GLYPHS.rank10;
      const width = (rank.width / rank.height) * geo.indexRankHeight;
      expect(width).toBeLessThan(geo.columnWidths[0]);
    }
  });

  test("is large enough to read at card size", () => {
    for (const [, geo] of decks) {
      expect(geo.indexHeight).toBeGreaterThanOrEqual(0.15 * geo.height);
    }
  });
});

describe("honour letter pair", () => {
  test("is centered on the card", () => {
    for (const [, geo] of decks) {
      expect(geo.honourLetterX).toBeCloseTo(geo.width / 2, 6);
      expect(geo.honourLetterX).toBeCloseTo(geo.centerPipCenter.x, 6);
      expect(geo.honourRuleY).toBeCloseTo(geo.height / 2, 6);
    }
  });

  test("leaves a gap between the letters and the rule", () => {
    for (const [, geo] of decks) {
      // Close enough to read as one mark, wide enough that no letter touches it.
      expect(geo.honourLetterGap).toBeGreaterThan(0);
      expect(geo.honourLetterGap).toBeLessThan(geo.honourLetterCap / 2);
      expect(geo.honourLetterGap).toBeLessThan(
        geo.honourRuleY - geo.honourRuleThickness / 2 - geo.pipFieldTop,
      );
    }
  });

  test("stays inside the frame", () => {
    for (const [, geo] of decks) {
      const innerLeft = geo.frameLeft + geo.frameStrokeWidth / 2;
      const innerRight = geo.frameRight - geo.frameStrokeWidth / 2;
      const innerTop = geo.frameTop + geo.frameStrokeWidth / 2;
      const innerBottom = geo.frameBottom - geo.frameStrokeWidth / 2;
      // The pair is anchored on the rule, so its outer edge is one cap height
      // and one gap away from it. Geometry does not know fonts, so the ink a
      // letter hangs below its baseline is checked in render.test.ts instead.
      const ruleTop = geo.honourRuleY - geo.honourRuleThickness / 2;
      const ruleBottom = geo.honourRuleY + geo.honourRuleThickness / 2;
      expect(
        ruleTop - geo.honourLetterGap - geo.honourLetterCap,
      ).toBeGreaterThan(innerTop);
      expect(
        ruleBottom + geo.honourLetterGap + geo.honourLetterCap,
      ).toBeLessThan(innerBottom);
      expect(geo.honourRuleWidth).toBeLessThan(geo.pipFieldWidth);
      expect(geo.centerPipCenter.x - geo.honourRuleWidth / 2).toBeGreaterThan(
        innerLeft,
      );
      expect(geo.centerPipCenter.x + geo.honourRuleWidth / 2).toBeLessThan(
        innerRight,
      );
    }
  });

  test("letters are large enough to read at card size", () => {
    for (const [, geo] of decks) {
      expect(geo.honourLetterCap).toBeGreaterThan(geo.indexRankHeight);
      expect(geo.honourRuleThickness).toBeGreaterThan(0);
    }
  });
});

describe("jumbo layout bounds", () => {
  test("leaves a margin inside the frame", () => {
    for (const [, geo] of decks) {
      expect(geo.jumboMaxWidth).toBeLessThan(geo.frameWidth);
      expect(geo.jumboMaxHeight).toBeLessThan(geo.frameHeight);
      expect(geo.jumboMaxWidth).toBeCloseTo(
        geo.frameWidth - geo.frameStrokeWidth - 2 * 2 * UNITS_PER_MM,
        6,
      );
    }
  });

  test("is larger than the standard center pip", () => {
    for (const [, geo] of decks) {
      expect(geo.jumboMaxHeight).toBeGreaterThan(geo.centerPipHeight);
    }
  });
});

describe("fixed physical sizes", () => {
  test("do not change with the card size", () => {
    expect(bridge.frameStrokeWidth).toBe(poker.frameStrokeWidth);
    expect(bridge.indexRankHeight).toBe(poker.indexRankHeight);
    expect(bridge.centerPipHeight).toBe(poker.centerPipHeight);
    expect(bridge.cornerRadius).toBe(poker.cornerRadius);
  });

  test("scale with the card where the layout is percentage based", () => {
    // Poker is wider, bridge is taller - the frame follows each card.
    expect(poker.frameWidth).toBeGreaterThan(bridge.frameWidth);
    expect(bridge.frameHeight).toBeGreaterThan(poker.frameHeight);
  });
});

import { describe, expect, test } from "bun:test";
import { GLYPHS, glyphById } from "./glyphs.ts";
import { RANK_GLYPH_ID, RANKS, SUIT_ORDER, SUIT_SYMBOL } from "./suits.ts";

const REQUIRED_IDS = [
  ...SUIT_ORDER,
  ...SUIT_ORDER.map((suit) => `${suit}Outlined`),
  ...RANKS.map((rank) => RANK_GLYPH_ID[rank]),
];

describe("glyph table", () => {
  test("covers every suit, outlined suit and rank", () => {
    for (const id of REQUIRED_IDS) {
      expect(glyphById(id), `missing glyph ${id}`).toBeDefined();
    }
  });

  test("holds usable path data for every glyph", () => {
    for (const [id, glyph] of Object.entries(GLYPHS)) {
      expect(glyph.d.length, `${id} has empty path`).toBeGreaterThan(0);
      expect(
        glyph.d.trim()[0]?.toUpperCase(),
        `${id} path must start with a move`,
      ).toBe("M");
      expect(glyph.width).toBeGreaterThan(0);
      expect(glyph.height).toBeGreaterThan(0);
      expect(Number.isFinite(glyph.x)).toBe(true);
      expect(Number.isFinite(glyph.y)).toBe(true);
    }
  });

  test("rank glyphs are vectorized from a bold weight", () => {
    for (const rank of RANKS) {
      const glyph = glyphById(RANK_GLYPH_ID[rank]);
      expect(glyph?.bold, `${rank} must be bold`).toBe(true);
    }
    for (const suit of SUIT_ORDER) {
      expect(glyphById(suit)?.bold).toBe(false);
    }
  });

  test("outlined variants have an inner contour so they read as hollow", () => {
    for (const suit of SUIT_ORDER) {
      const solid = glyphById(suit)?.d ?? "";
      const outlined = glyphById(`${suit}Outlined`)?.d ?? "";
      expect(outlined).not.toBe(solid);
      const subpaths = outlined.split(/(?=[Mm])/).filter(Boolean).length;
      expect(subpaths).toBeGreaterThanOrEqual(2);
    }
  });

  test("matches the documented unicode symbols", () => {
    expect(SUIT_SYMBOL.spades.solid).toBe("\u{2660}");
    expect(SUIT_SYMBOL.hearts.solid).toBe("\u{2665}");
    expect(SUIT_SYMBOL.diamonds.solid).toBe("\u{2666}");
    expect(SUIT_SYMBOL.clubs.solid).toBe("\u{2663}");
    expect(SUIT_SYMBOL.spades.outlined).toBe("\u{2664}");
    expect(SUIT_SYMBOL.hearts.outlined).toBe("\u{2661}");
    expect(SUIT_SYMBOL.diamonds.outlined).toBe("\u{2662}");
    expect(SUIT_SYMBOL.clubs.outlined).toBe("\u{2667}");
  });
});

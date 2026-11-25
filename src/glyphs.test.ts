import { describe, expect, test } from "bun:test";
import {
  DEFAULT_FONT,
  FONT_NAMES,
  FONT_SETS,
  GLYPHS,
  fontSet,
  glyphById,
  isFontName,
} from "./glyphs.ts";
import {
  RANK_GLYPH_ID,
  RANKS,
  SUIT_ORDER,
  SUIT_SYMBOL,
  type GlyphId,
} from "./suits.ts";

const REQUIRED_IDS: readonly GlyphId[] = [
  ...SUIT_ORDER,
  ...SUIT_ORDER.map((suit) => `${suit}Outlined` as GlyphId),
  ...RANKS.map((rank) => RANK_GLYPH_ID[rank]),
];

const SETS: readonly [string, (typeof FONT_SETS)[keyof typeof FONT_SETS]][] =
  FONT_NAMES.map((name) => [name, FONT_SETS[name]]);

describe("glyph table", () => {
  test("covers every suit, outlined suit and rank in every font", () => {
    for (const [name, set] of SETS) {
      for (const id of REQUIRED_IDS) {
        expect(set[id], `${name}: missing glyph ${id}`).toBeDefined();
      }
      expect(Object.keys(set).sort()).toEqual([...REQUIRED_IDS].sort());
    }
  });

  test("holds usable path data for every glyph", () => {
    for (const [name, set] of SETS) {
      for (const [id, glyph] of Object.entries(set)) {
        expect(glyph.d.length, `${name}/${id} has empty path`).toBeGreaterThan(
          0,
        );
        expect(
          glyph.d.trim()[0]?.toUpperCase(),
          `${name}/${id} path must start with a move`,
        ).toBe("M");
        expect(glyph.width, `${name}/${id} width`).toBeGreaterThan(0);
        expect(glyph.height, `${name}/${id} height`).toBeGreaterThan(0);
        expect(Number.isFinite(glyph.x), `${name}/${id} x`).toBe(true);
        expect(Number.isFinite(glyph.y), `${name}/${id} y`).toBe(true);
      }
    }
  });

  test("rank glyphs are vectorized from a bold weight", () => {
    for (const [name, set] of SETS) {
      for (const rank of RANKS) {
        expect(
          set[RANK_GLYPH_ID[rank]].bold,
          `${name}: ${rank} must be bold`,
        ).toBe(true);
      }
      for (const suit of SUIT_ORDER) {
        expect(set[suit].bold, `${name}: ${suit} must not be bold`).toBe(false);
      }
    }
  });

  test("outlined variants have an inner contour so they read as hollow", () => {
    for (const [name, set] of SETS) {
      for (const suit of SUIT_ORDER) {
        const solid = set[suit].d;
        const outlined = set[`${suit}Outlined` as const].d;
        expect(outlined, `${name}: ${suit}`).not.toBe(solid);
        const subpaths = outlined.split(/(?=[Mm])/).filter(Boolean).length;
        expect(subpaths, `${name}: ${suit}Outlined`).toBeGreaterThanOrEqual(2);
      }
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

describe("font registry", () => {
  test("lists every registered font exactly once", () => {
    expect(new Set(FONT_NAMES).size).toBe(FONT_NAMES.length);
    for (const name of FONT_NAMES) {
      expect(FONT_SETS[name]).toBeDefined();
    }
  });

  test("has a default font that is part of the registry", () => {
    expect(FONT_NAMES).toContain(DEFAULT_FONT);
    expect(fontSet()).toBe(FONT_SETS[DEFAULT_FONT]);
    expect(GLYPHS).toBe(FONT_SETS[DEFAULT_FONT]);
  });

  test("every font draws a visibly different card", () => {
    // Two fonts must not collapse onto the same outlines, or the flag is a no-op.
    const paths = FONT_NAMES.map((name) => fontSet(name).rankA.d);
    expect(new Set(paths).size).toBe(FONT_NAMES.length);
  });

  test("font names are accepted case-sensitively and rejected otherwise", () => {
    expect(isFontName(DEFAULT_FONT)).toBe(true);
    expect(isFontName("noto sans")).toBe(false);
    expect(isFontName("Comic Sans")).toBe(false);
  });

  test("glyphById defaults to the default font", () => {
    expect(glyphById("rankA")).toBe(GLYPHS.rankA);
    expect(glyphById("rankA", DEFAULT_FONT)).toBe(GLYPHS.rankA);
    expect(glyphById("nope")).toBeUndefined();
  });
});

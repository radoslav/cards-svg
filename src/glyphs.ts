/**
 * Public glyph API: the vectorized glyph sets that the card generator can draw
 * with, plus the lookup helpers.
 *
 * The sets themselves are generated per font (see `tools/extract-glyphs.ts`) and
 * live in `src/fonts/`. A set is keyed exhaustively by `GlyphId`, so adding a
 * rank or a suit fails to compile until every font has been regenerated.
 */
import type { GlyphId } from "./suits.ts";
import { FREE_SANS } from "./fonts/free-sans.ts";
import { NOTO_SANS } from "./fonts/noto-sans.ts";
import type { Glyph, GlyphSet } from "./fonts/types.ts";

export type { Glyph, GlyphSet } from "./fonts/types.ts";

/**
 * The available fonts, keyed by the name accepted on the command line. Each set
 * must cover every `GlyphId`, which is what `GlyphSet` enforces.
 */
export const FONT_SETS = {
  FreeSans: FREE_SANS,
  "Noto Sans": NOTO_SANS,
} satisfies Record<string, GlyphSet>;

export type FontName = keyof typeof FONT_SETS;

/**
 * Every registered font, derived from the registry so the two cannot drift.
 * Typed as a non-empty tuple because the CLI choice parser needs one.
 */
export const FONT_NAMES = Object.keys(FONT_SETS) as unknown as [
  FontName,
  ...FontName[],
];

/** The font used when a card does not ask for one. */
export const DEFAULT_FONT: FontName = "FreeSans";

/** Glyph set of a font, defaulting to `DEFAULT_FONT`. */
export function fontSet(font: FontName = DEFAULT_FONT): GlyphSet {
  return FONT_SETS[font];
}

/** Glyph set of the default font, for callers that do not care about fonts. */
export const GLYPHS: GlyphSet = FONT_SETS[DEFAULT_FONT];

/** Looks up a glyph by an untrusted identifier. */
export function glyphById(
  id: string,
  font: FontName = DEFAULT_FONT,
): Glyph | undefined {
  return (FONT_SETS[font] as Record<string, Glyph>)[id];
}

/** True when `name` names a registered font. */
export function isFontName(name: string): name is FontName {
  return Object.hasOwn(FONT_SETS, name);
}

/** Identifier type re-exported so consumers do not need `suits.ts` for it. */
export type { GlyphId };

import type { GlyphId } from "../suits.ts";

/**
 * A single vectorized glyph.
 *
 * Path data lives in the source font's coordinate space, vectorized at a nominal
 * font size. `x`/`y`/`width`/`height` describe its bounding box in that same
 * space, so a caller can scale and center the glyph without parsing the path.
 */
export interface Glyph {
  /** Path data in the source font coordinate space. */
  readonly d: string;
  /** Bounding box of the path data. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /**
   * Y of the font baseline in the same coordinate space. Letters such as `J` and
   * `Q` ink below it, so their bounding box is taller than the visible letter
   * height; the distance from the baseline to `y` is what makes two letters look
   * like the same size.
   */
  readonly baseline: number;
  /** True when the glyph was vectorized from a bold font weight. */
  readonly bold: boolean;
}

/**
 * Every glyph a card needs, for one font. Keyed exhaustively by `GlyphId`, so a
 * set that is missing a glyph does not compile.
 */
export type GlyphSet = Record<GlyphId, Glyph>;

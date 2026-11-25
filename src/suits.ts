/**
 * Suit metadata for bridge cards, in bridge ranking order (spades first).
 */
export const SUIT_ORDER = ["spades", "hearts", "diamonds", "clubs"] as const;

export type Suit = (typeof SUIT_ORDER)[number];

/** Ranks in bridge order, highest first. */
export const RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "10",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;

export type Rank = (typeof RANKS)[number];

/** Glyph styles: filled symbols, or hollow outlined ones. */
export const SUIT_STYLES = ["solid", "outlined"] as const;

export type SuitStyle = (typeof SUIT_STYLES)[number];

/**
 * Identifiers of the vectorized glyphs a card needs, derived from the suits and
 * ranks. Owning the union here (rather than deriving it from one generated file)
 * lets every font set be checked against the same complete list.
 */
export type GlyphId = Suit | `${Suit}Outlined` | `rank${Rank}`;

/**
 * Middle column layouts: five pips, a single oversized one, or the traditional
 * pip pattern of the rank.
 */
export const CARD_LAYOUTS = ["standard", "jumbo", "traditional"] as const;

export type CardLayout = (typeof CARD_LAYOUTS)[number];

/**
 * Layout used when a card does not ask for one. `traditional` matches a printed
 * deck: the middle column shows the pip pattern of the rank, and the ace and
 * the face cards fall back to the five-pip layout.
 */
export const DEFAULT_LAYOUT: CardLayout = "traditional";

/** Unicode symbols per suit, keyed by rendering style. */
export const SUIT_SYMBOL: Record<Suit, Record<SuitStyle, string>> = {
  spades: { solid: "\u{2660}", outlined: "\u{2664}" },
  hearts: { solid: "\u{2665}", outlined: "\u{2661}" },
  diamonds: { solid: "\u{2666}", outlined: "\u{2662}" },
  clubs: { solid: "\u{2663}", outlined: "\u{2667}" },
};

/** Glyph identifiers for supported ranks, in `src/glyphs.ts`. */
export const RANK_GLYPH_ID: Record<Rank, GlyphId> = {
  A: "rankA",
  K: "rankK",
  Q: "rankQ",
  J: "rankJ",
  "10": "rank10",
  "9": "rank9",
  "8": "rank8",
  "7": "rank7",
  "6": "rank6",
  "5": "rank5",
  "4": "rank4",
  "3": "rank3",
  "2": "rank2",
};

/** Identifier of the vectorized glyph for a suit and style. */
export function glyphIdFor(suit: Suit, style: SuitStyle): GlyphId {
  return style === "solid" ? suit : (`${suit}Outlined` as GlyphId);
}

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export const COLOR_RED = "#C8102E";
export const COLOR_BLACK = "#1A1A1A";
export const COLOR_BACKGROUND = "#FFFFFF";

export function defaultColor(suit: Suit): string {
  return isRed(suit) ? COLOR_RED : COLOR_BLACK;
}

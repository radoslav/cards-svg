import type { CardSize } from "./layout.ts";
import {
  RANKS,
  SUIT_ORDER,
  type CardLayout,
  type Rank,
  type Suit,
} from "./suits.ts";

/** Deck presets selectable from the CLI. */
export const DECK_NAMES = ["bridge", "poker"] as const;

export type DeckName = (typeof DECK_NAMES)[number];

export interface DeckSpec {
  readonly name: DeckName;
  /** Physical card size. */
  readonly size: CardSize;
  /** Middle column layout used for every card in the deck. */
  readonly layout: CardLayout;
  /** Directory the deck is written to, relative to the output root. */
  readonly directory: string;
}

export const DECKS: Record<DeckName, DeckSpec> = {
  bridge: {
    name: "bridge",
    size: { widthMm: 57, heightMm: 89 },
    layout: "traditional",
    directory: "bridge",
  },
  poker: {
    name: "poker",
    size: { widthMm: 63, heightMm: 88 },
    layout: "jumbo",
    directory: "poker",
  },
};

/** A single card inside a deck, ready to render. */
export interface DeckCard {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** All 52 cards, in bridge order: suits descending, ranks descending. */
export function deckCards(): readonly DeckCard[] {
  return SUIT_ORDER.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

/** File name for a card, e.g. `spades-A.svg`. Ranks like `10` stay readable. */
export function cardFileName(card: DeckCard): string {
  return `${card.suit}-${card.rank}.svg`;
}

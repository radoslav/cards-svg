import {
  buildChoiceParser,
  buildCommand,
  type InputParser,
} from "@stricli/core";
import type { CardContext } from "./context.ts";
import { hexColorParser } from "./parsers.ts";
import { DECK_NAMES, DECKS, type DeckName } from "../decks.ts";
import {
  CARD_LAYOUTS,
  RANKS,
  SUIT_ORDER,
  type CardLayout,
  type Rank,
  type Suit,
  type SuitStyle,
} from "../suits.ts";

interface GenerateFlags {
  readonly style: SuitStyle;
  readonly layout?: CardLayout;
  readonly deck?: DeckName;
  readonly color?: string;
  readonly out?: string;
  readonly pretty: boolean;
}

type GenerateArgs = readonly [Suit, Rank];

/** Accepts both the plural and singular suit names. */
const SUIT_ALIASES: Readonly<Record<string, Suit>> = {
  spade: "spades",
  heart: "hearts",
  diamond: "diamonds",
  club: "clubs",
};

const suitParser: InputParser<Suit> = (input: string): Suit => {
  const key = input.trim().toLowerCase();
  const suit = SUIT_ORDER.find((value) => value === key) ?? SUIT_ALIASES[key];
  if (!suit) {
    throw new Error(`expected one of ${SUIT_ORDER.join(", ")}, got "${input}"`);
  }
  return suit;
};
const rankParser = buildChoiceParser(RANKS);

export const generateCommand = buildCommand<
  GenerateFlags,
  GenerateArgs,
  CardContext
>({
  docs: {
    brief: "Generate a single card as SVG",
    fullDescription:
      "Renders one card built from three columns (20% / 60% / 20%). " +
      "Column 1 holds the index at the top, column 2 holds a framed pip layout " +
      "with one large center pip and four corner pips (the bottom pair rotated) " +
      "by default, and column 3 repeats the index rotated at the bottom. " +
      "With --layout traditional the middle column shows the pip pattern of the " +
      "rank (2-10); aces and face cards keep the five-pip layout. " +
      "The output contains only vector paths, so it renders identically without fonts.",
    customUsage: ["[suit] [rank] [options]", "diamonds A > diamond-A.svg"],
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Suit, in bridge order (default diamonds)",
          parse: suitParser,
          proposeCompletions: (partial: string) =>
            SUIT_ORDER.filter((suit) => suit.startsWith(partial)),
          default: "diamonds",
          placeholder: "suit",
        },
        {
          brief: "Rank (default A)",
          parse: rankParser,
          default: "A",
          placeholder: "rank",
        },
      ],
    },
    flags: {
      style: {
        kind: "enum",
        brief: "Glyph style",
        values: ["solid", "outlined"] as const,
        default: "solid",
      },
      layout: {
        kind: "enum",
        brief:
          "Middle column: five pips, one oversized symbol, or the rank's pip pattern",
        values: CARD_LAYOUTS,
        optional: true,
      },
      deck: {
        kind: "enum",
        brief: "Use a deck preset's card size and layout",
        values: DECK_NAMES,
        optional: true,
      },
      color: {
        kind: "parsed",
        parse: hexColorParser,
        brief: "Override the card color",
        placeholder: "hex",
        optional: true,
      },
      out: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Write the SVG to this path instead of stdout",
        placeholder: "path",
        optional: true,
      },
      pretty: {
        kind: "boolean",
        brief: "Pretty-print the SVG",
        default: true,
      },
    },
  },
  func: async function (flags, suit, rank) {
    const { renderCard } = await import("../render.ts");
    // A deck preset supplies size and layout; explicit flags still win.
    const preset = flags.deck ? DECKS[flags.deck] : undefined;
    const svg = renderCard({
      suit,
      rank,
      style: flags.style,
      layout: flags.layout ?? preset?.layout,
      size: preset?.size,
      color: flags.color,
      pretty: flags.pretty,
    });

    if (flags.out) {
      const written = await Bun.write(flags.out, svg);
      this.process.stdout.write(`wrote ${written} bytes to ${flags.out}\n`);
      return;
    }
    this.process.stdout.write(svg);
  },
});

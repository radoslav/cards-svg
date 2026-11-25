import { buildCommand } from "@stricli/core";
import type { CardContext } from "./context.ts";
import {
  choiceFlag,
  hexColorParser,
  pathParser,
  rankParser,
  suitCompletions,
  suitParser,
} from "./parsers.ts";
import { DECK_NAMES, DECKS, type DeckName } from "../decks.ts";
import { FONT_NAMES, type FontName } from "../glyphs.ts";
import {
  CARD_LAYOUTS,
  DEFAULT_LAYOUT,
  SUIT_STYLES,
  type CardLayout,
  type Rank,
  type Suit,
  type SuitStyle,
} from "../suits.ts";

interface GenerateFlags {
  readonly style: SuitStyle;
  readonly layout?: CardLayout;
  readonly deck?: DeckName;
  readonly font?: FontName;
  readonly color?: string;
  readonly out?: string;
  readonly pretty: boolean;
}

type GenerateArgs = readonly [Suit, Rank];

export const generateCommand = buildCommand<
  GenerateFlags,
  GenerateArgs,
  CardContext
>({
  docs: {
    brief: "Generate a single card as SVG",
    fullDescription:
      "Renders one card built from three columns (20% / 60% / 20%). " +
      "Column 1 holds the index at the top, column 2 holds a framed pip layout, " +
      "and column 3 repeats the index rotated at the bottom. " +
      `With --layout ${DEFAULT_LAYOUT} the middle column shows the pip pattern ` +
      "of the rank (2-10); aces and face cards fall back to the five-pip " +
      "standard layout, as does --layout standard. " +
      "With --font the rank and suit glyphs come from another vectorized font. " +
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
          proposeCompletions: suitCompletions,
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
        ...choiceFlag(SUIT_STYLES, "style", "Glyph style"),
        default: "solid",
      },
      layout: {
        ...choiceFlag(
          CARD_LAYOUTS,
          "layout",
          `Middle column layout, default ${DEFAULT_LAYOUT}`,
        ),
        optional: true,
      },
      deck: {
        ...choiceFlag(
          DECK_NAMES,
          "deck",
          "Use a deck preset's card size, layout and font",
        ),
        optional: true,
      },
      font: {
        ...choiceFlag(FONT_NAMES, "font", "Vectorized font set for the glyphs"),
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
        parse: pathParser,
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
    // A deck preset supplies size, layout and font; explicit flags still win.
    const preset = flags.deck ? DECKS[flags.deck] : undefined;
    const svg = renderCard({
      suit,
      rank,
      style: flags.style,
      layout: flags.layout ?? preset?.layout,
      size: preset?.size,
      font: flags.font ?? preset?.font,
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

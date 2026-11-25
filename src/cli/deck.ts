import { buildCommand } from "@stricli/core";
import { DECKS, type DeckName } from "../decks.ts";
import { FONT_NAMES, type FontName } from "../glyphs.ts";
import { writeDeck } from "../deck.ts";
import type { CardContext } from "./context.ts";
import {
  choiceFlag,
  deckCompletions,
  deckParser,
  fontParser,
  pathParser,
} from "./parsers.ts";

interface DeckFlags {
  readonly outDir: string;
  readonly font?: FontName;
}

type DeckArgs = readonly [DeckName];

export const deckCommand = buildCommand<DeckFlags, DeckArgs, CardContext>({
  docs: {
    brief: "Generate a full 52-card deck into a directory",
    fullDescription:
      "Writes all 52 cards as individual SVG files into <out-dir>/<deck>/. " +
      "The bridge deck is 57 x 89 mm with the traditional pip pattern of each " +
      "rank, the poker deck is 63 x 88 mm with the jumbo layout. " +
      "--font overrides the vectorized font set the deck is drawn with.",
    customUsage: ["[deck] [options]", "poker --out-dir out"],
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Deck preset to generate",
          parse: deckParser,
          proposeCompletions: deckCompletions,
          placeholder: "deck",
        },
      ],
    },
    flags: {
      outDir: {
        kind: "parsed",
        parse: pathParser,
        brief: "Output root directory",
        placeholder: "path",
        default: "out",
      },
      font: {
        ...choiceFlag(FONT_NAMES, "font", "Vectorized font set for the glyphs"),
        optional: true,
      },
    },
  },
  func: async function (flags, deckName) {
    const deck = flags.font
      ? { ...DECKS[deckName], font: flags.font }
      : DECKS[deckName];
    const result = await writeDeck(deck, flags.outDir);
    this.process.stdout.write(
      `wrote 52 cards to ${result.directory}/ (${result.written} bytes)\n`,
    );
  },
});

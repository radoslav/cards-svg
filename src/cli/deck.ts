import { buildChoiceParser, buildCommand } from "@stricli/core";
import { DECK_NAMES, DECKS, type DeckName } from "../decks.ts";
import { writeDeck } from "../deck.ts";
import type { CardContext } from "./context.ts";

interface DeckFlags {
  readonly outDir: string;
}

type DeckArgs = readonly [DeckName];

const deckParser = buildChoiceParser(DECK_NAMES);

export const deckCommand = buildCommand<DeckFlags, DeckArgs, CardContext>({
  docs: {
    brief: "Generate a full 52-card deck into a directory",
    fullDescription:
      "Writes all 52 cards as individual SVG files into <out-dir>/<deck>/. " +
      "The bridge deck is 57 x 89 mm with the traditional pip pattern of each " +
      "rank, the poker deck is 63 x 88 mm with the jumbo layout.",
    customUsage: ["[deck] [options]", "poker --out-dir out"],
  },
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Deck preset to generate",
          parse: deckParser,
          placeholder: "deck",
        },
      ],
    },
    flags: {
      outDir: {
        kind: "parsed",
        parse: (input: string) => input,
        brief: "Output root directory",
        placeholder: "path",
        default: "out",
      },
    },
  },
  func: async function (flags, deckName) {
    const deck = DECKS[deckName];
    const result = await writeDeck(deck, flags.outDir);
    this.process.stdout.write(
      `wrote 52 cards to ${result.directory}/ (${result.written} bytes)\n`,
    );
  },
});

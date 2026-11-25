import { cardFileName, deckCards, type DeckSpec } from "./decks.ts";
import { renderCard } from "./render.ts";

export interface DeckCardFile {
  readonly fileName: string;
  readonly svg: string;
}

/** Renders every card of a deck, in bridge order. */
export function renderDeck(deck: DeckSpec): readonly DeckCardFile[] {
  return deckCards().map((card) => ({
    fileName: cardFileName(card),
    svg: renderCard({
      suit: card.suit,
      rank: card.rank,
      size: deck.size,
      layout: deck.layout,
    }),
  }));
}

/** Writes a rendered deck to `<root>/<deck.directory>/`. */
export async function writeDeck(
  deck: DeckSpec,
  root: string,
): Promise<{ readonly directory: string; readonly written: number }> {
  const directory = `${root}/${deck.directory}`;
  const files = renderDeck(deck);
  let written = 0;
  for (const file of files) {
    written += await Bun.write(`${directory}/${file.fileName}`, file.svg);
  }
  return { directory, written };
}

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardFileName, DECKS, DECK_NAMES, deckCards } from "./decks.ts";
import { renderDeck, writeDeck } from "./deck.ts";
import { cardGeometry } from "./layout.ts";
import { RANKS, SUIT_ORDER } from "./suits.ts";

/** How many shared glyphs the middle column of a rendered card references. */
function pipReferences(svg: string): number {
  const body = svg.slice(svg.indexOf("</defs>"));
  const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
  return (group.match(/<use/g) ?? []).length;
}

describe("deck presets", () => {
  test("bridge is 57 x 89 mm with the traditional layout", () => {
    expect(DECKS.bridge.size).toEqual({ widthMm: 57, heightMm: 89 });
    expect(DECKS.bridge.layout).toBe("traditional");
    expect(DECKS.bridge.directory).toBe("bridge");
  });

  test("poker is 63 x 88 mm with the jumbo layout", () => {
    expect(DECKS.poker.size).toEqual({ widthMm: 63, heightMm: 88 });
    expect(DECKS.poker.layout).toBe("jumbo");
    expect(DECKS.poker.directory).toBe("poker");
  });

  test("every preset has a distinct output directory", () => {
    const directories = DECK_NAMES.map((name) => DECKS[name].directory);
    expect(new Set(directories).size).toBe(DECK_NAMES.length);
  });
});

describe("deck cards", () => {
  test("has 52 unique cards", () => {
    const cards = deckCards();
    expect(cards).toHaveLength(52);
    const keys = new Set(cards.map((c) => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
  });

  test("covers every suit and rank", () => {
    const cards = deckCards();
    for (const suit of SUIT_ORDER) {
      for (const rank of RANKS) {
        expect(cards).toContainEqual({ suit, rank });
      }
    }
  });

  test("is in bridge order - suits first, ranks descending", () => {
    const cards = deckCards();
    expect(cards[0]).toEqual({ suit: "spades", rank: "A" });
    expect(cards[13]).toEqual({ suit: "hearts", rank: "A" });
    expect(cards[12]).toEqual({ suit: "spades", rank: "2" });
    expect(cards[51]).toEqual({ suit: "clubs", rank: "2" });
  });

  test("file names are unique and safe", () => {
    const names = deckCards().map(cardFileName);
    expect(new Set(names).size).toBe(52);
    for (const name of names) {
      expect(name).toMatch(/^[\w-]+\.svg$/);
    }
  });
});

describe("renderDeck", () => {
  test("renders 52 files per deck", () => {
    for (const name of DECK_NAMES) {
      expect(renderDeck(DECKS[name])).toHaveLength(52);
    }
  });

  test("uses the deck size and layout", () => {
    const poker = renderDeck(DECKS.poker);
    const [first] = poker;
    expect(first!.svg).toContain('width="63mm"');
    expect(first!.svg).toContain('height="88mm"');
    // Jumbo: the middle column references one shared glyph.
    const body = first!.svg.slice(first!.svg.indexOf("</defs>"));
    const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
    expect((group.match(/<use/g) ?? []).length).toBe(1);
  });

  test("bridge cards use the traditional pip pattern of each rank", () => {
    const deck = new Map(
      renderDeck(DECKS.bridge).map((f) => [f.fileName, f.svg]),
    );
    const [first] = renderDeck(DECKS.bridge);
    expect(first!.svg).toContain('width="57mm"');
    expect(first!.svg).toContain('height="89mm"');
    // The ace has no pip pattern, so it keeps the standard five pips.
    expect(pipReferences(deck.get("spades-A.svg")!)).toBe(5);
    for (const rank of ["2", "3", "4", "5", "6", "7", "8", "9", "10"]) {
      expect(pipReferences(deck.get(`spades-${rank}.svg`)!)).toBe(Number(rank));
    }
  });

  test("every card fits its deck geometry", () => {
    for (const name of DECK_NAMES) {
      const geo = cardGeometry(DECKS[name].size);
      for (const file of renderDeck(DECKS[name])) {
        expect(file.svg).toContain(`viewBox="0 0 ${geo.width} ${geo.height}"`);
      }
    }
  });
});

describe("writeDeck", () => {
  test("writes 52 files into <root>/<deck>/", async () => {
    const root = await mkdtemp(join(tmpdir(), "cards-svg-deck-"));
    try {
      for (const name of DECK_NAMES) {
        const result = await writeDeck(DECKS[name], root);
        expect(result.directory).toBe(`${root}/${DECKS[name].directory}`);
        expect(result.written).toBeGreaterThan(0);
      }
      for (const name of DECK_NAMES) {
        const file = Bun.file(
          join(root, DECKS[name].directory, "spades-A.svg"),
        );
        expect(await file.exists()).toBe(true);
        const text = await file.text();
        expect(text).toContain("</svg>");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

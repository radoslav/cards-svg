import type { InputParser } from "@stricli/core";
import { DECK_NAMES, type DeckName } from "../decks.ts";
import { FONT_NAMES, type FontName } from "../glyphs.ts";
import {
  CARD_LAYOUTS,
  RANKS,
  SUIT_ORDER,
  SUIT_STYLES,
  type CardLayout,
  type Rank,
  type Suit,
  type SuitStyle,
} from "../suits.ts";

/** Collapses whitespace and case so `Noto Sans` and `noto sans` are the same. */
function fold(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Levenshtein distance, used only to suggest a correction for a typo. */
function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);
  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + cost,
      );
    }
    for (let column = 0; column <= b.length; column += 1) {
      previous[column] = current[column]!;
    }
  }
  return previous[b.length]!;
}

/** Values close enough that naming them beats a bare list of everything. */
function corrections(
  input: string,
  values: readonly string[],
): readonly string[] {
  const folded = fold(input);
  const limit = folded.length <= 4 ? 1 : 2;
  return values.filter(
    (value) =>
      fold(value).startsWith(folded) ||
      editDistance(folded, fold(value)) <= limit,
  );
}

function quoted(values: readonly string[]): string {
  return values.map((value) => `"${value}"`).join(", ");
}

/**
 * A case-insensitive choice parser over a fixed list of values.
 *
 * Stricli's own enum parser matches exactly, which made the CLI inconsistent: a
 * suit was accepted in any case while a rank or a `--style` was not. This parser
 * folds case and runs of whitespace, so `--style OUTLINED` and
 * `--font "noto sans"` work too. Unknown input lists the valid values and the
 * closest match, the way the built-in enum parser does.
 */
function choiceParser<T extends string>(
  values: readonly T[],
  label: string,
): (input: string) => T {
  const byFoldedKey = new Map<string, T>(
    values.map((value) => [fold(value), value]),
  );
  return (input: string): T => {
    const match = byFoldedKey.get(fold(input));
    if (match !== undefined) {
      return match;
    }
    // The canonical spellings, not an upper-cased list: `FreeSans` and
    // `Noto Sans` are the values a user has to type back.
    const expected = values.join("|");
    const near = corrections(input, values);
    const hint = near.length > 0 ? `, did you mean ${quoted(near)}?` : "";
    throw new Error(
      `expected ${label} to be one of (${expected}), got "${input}"${hint}`,
    );
  };
}

/**
 * Completions for a choice parameter.
 *
 * The fold here keeps this consistent with the parser, but note that Stricli
 * additionally filters every proposed completion with a case-sensitive
 * `startsWith`, so shell completion still only offers lowercase input. The
 * parser is what accepts `--style OUTLINED`.
 */
function proposeChoices<T extends string>(
  values: readonly T[],
  partial: string,
): readonly T[] {
  const folded = fold(partial);
  if (folded.length === 0) {
    return values;
  }
  return values.filter((value) => fold(value).startsWith(folded));
}

/**
 * The shared shape of a case-insensitive choice parameter: a `parsed` flag plus
 * its parser and completions. Callers add `optional: true` or a `default`,
 * because Stricli types those two as mutually exclusive.
 */
export interface ChoiceParameter<T extends string> {
  readonly kind: "parsed";
  readonly parse: InputParser<T>;
  readonly brief: string;
  readonly placeholder: string;
  readonly proposeCompletions: (partial: string) => readonly T[];
}

/**
 * A case-insensitive choice flag, ready to gain `optional` or `default`.
 *
 * Stricli only prints the list of allowed values in `--help` for `kind: "enum"`
 * parameters, which the case-insensitive parser cannot use, so the list is
 * appended to the brief here instead. Deriving it from `values` keeps the help
 * text from drifting away from what is actually accepted.
 */
export function choiceFlag<T extends string>(
  values: readonly T[],
  label: string,
  brief: string,
): ChoiceParameter<T> {
  return {
    kind: "parsed",
    parse: choiceParser(values, label),
    brief: `${brief} (${values.join("|")})`,
    placeholder: label,
    proposeCompletions: (partial: string) => proposeChoices(values, partial),
  };
}

/** Accepts `#RRGGBB` or `RRGGBB` and normalizes to the `#`-prefixed form. */
export const hexColorParser = (input: string): string => {
  const value = input.trim();
  const normalized = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`expected a hex color like #C8102E, got "${input}"`);
  }
  return normalized.toUpperCase();
};

/** Rejects an empty path instead of silently falling back to stdout. */
export const pathParser = (input: string): string => {
  if (input.trim().length === 0) {
    throw new Error("expected a file path, got an empty value");
  }
  return input;
};

/** Accepts both the plural and singular suit names, in any case. */
const SUIT_ALIASES: Readonly<Record<string, Suit>> = {
  spade: "spades",
  heart: "hearts",
  diamond: "diamonds",
  club: "clubs",
};

export const suitParser = (input: string): Suit => {
  const key = fold(input);
  const suit = SUIT_ORDER.find((value) => value === key) ?? SUIT_ALIASES[key];
  if (!suit) {
    const near = corrections(input, [
      ...SUIT_ORDER,
      ...Object.keys(SUIT_ALIASES),
    ]);
    const hint = near.length > 0 ? `, did you mean ${quoted(near)}?` : "";
    throw new Error(
      `expected suit to be one of (${SUIT_ORDER.join("|")}), got "${input}"${hint}`,
    );
  }
  return suit;
};

export const suitCompletions = (partial: string): readonly Suit[] =>
  proposeChoices(SUIT_ORDER, partial);

export const deckCompletions = (partial: string): readonly DeckName[] =>
  proposeChoices(DECK_NAMES, partial);

export const fontCompletions = (partial: string): readonly FontName[] =>
  proposeChoices(FONT_NAMES, partial);

export const rankParser = choiceParser(RANKS, "rank");
export const styleParser = choiceParser(SUIT_STYLES, "style");
export const layoutParser = choiceParser(CARD_LAYOUTS, "layout");
export const deckParser = choiceParser(DECK_NAMES, "deck");
export const fontParser = choiceParser(FONT_NAMES, "font");

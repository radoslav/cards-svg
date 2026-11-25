/**
 * Traditional pip layouts for the numeric ranks.
 *
 * Positions are normalized inside the pip field of the middle column: `fx` and
 * `fy` run from 0 to 1, where 0 is the inner edge of the frame on the left/top
 * and 1 is the inner edge on the right/bottom. `layout.ts` turns them into
 * absolute coordinates, so the same table works for every card size.
 *
 * The conventions are the ones of a standard deck: pips sit in two side
 * columns, the center column holds the odd ones, and everything below the
 * middle line is turned upside down.
 */

/** Ranks drawn with a traditional pip pattern. */
export const PIP_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
] as const;

export type PipRank = (typeof PIP_RANKS)[number];

/** A pip position, normalized to the pip field. */
export interface PipSlot {
  readonly fx: number;
  readonly fy: number;
}

/** The two side columns and the center of the field. */
const LEFT = 0.25;
const CENTER = 0.5;
const RIGHT = 0.75;

/** `count` evenly spaced rows, with half a gap of margin at both ends. */
function rows(count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => (2 * index + 1) / (2 * count),
  );
}

/** Two side columns of `count` rows each. */
function sideColumns(count: number): PipSlot[] {
  return rows(count).flatMap((fy) => [
    { fx: LEFT, fy },
    { fx: RIGHT, fy },
  ]);
}

/** Pips in the center column, at the given normalized heights. */
function centerColumn(...fys: readonly number[]): PipSlot[] {
  return fys.map((fy) => ({ fx: CENTER, fy }));
}

/** Sorted top to bottom, left to right, so the output order is stable. */
function slots(...pips: readonly PipSlot[][]): readonly PipSlot[] {
  return pips
    .flat()
    .sort((a, b) => (a.fy === b.fy ? a.fx - b.fx : a.fy - b.fy));
}

// The odd pips sit in the gaps between the rows of the side columns: 1/3 and
// 2/3 below a three-row column, 1/4 and 3/4 below a four-row one. Only the
// outer gaps are used for four rows - the middle gap would add an eleventh pip
// to the ten.
const THREE_ROW_GAPS = [1 / 3, 2 / 3];
const FOUR_ROW_OUTER_GAPS = [1 / 4, 3 / 4];

/** Pip patterns per rank, in traditional playing-card order. */
export const PIP_LAYOUTS: Record<PipRank, readonly PipSlot[]> = {
  "2": slots(centerColumn(...rows(2))),
  "3": slots(centerColumn(...rows(3))),
  "4": slots(sideColumns(2)),
  "5": slots(sideColumns(2), centerColumn(1 / 2)),
  "6": slots(sideColumns(3)),
  "7": slots(sideColumns(3), centerColumn(THREE_ROW_GAPS[0]!)),
  "8": slots(sideColumns(3), centerColumn(...THREE_ROW_GAPS)),
  "9": slots(sideColumns(4), centerColumn(1 / 2)),
  "10": slots(sideColumns(4), centerColumn(...FOUR_ROW_OUTER_GAPS)),
};

const PIP_RANK_SET: ReadonlySet<string> = new Set<string>(PIP_RANKS);

/** True when a rank is drawn with a traditional pip pattern. */
export function isPipRank(rank: string): rank is PipRank {
  return PIP_RANK_SET.has(rank);
}

/** How many pips a rank shows in the middle column. */
export function pipCount(rank: PipRank): number {
  return PIP_LAYOUTS[rank].length;
}

/**
 * The bridge honours. These have no pip count, so the middle column shows the
 * rank letter instead of a suit symbol: a stacked pair in the `traditional`
 * layout, one large letter in `jumbo`.
 */
export const HONOUR_RANKS = ["A", "K", "Q", "J"] as const;

export type HonourRank = (typeof HONOUR_RANKS)[number];

const HONOUR_RANK_SET: ReadonlySet<string> = new Set<string>(HONOUR_RANKS);

/** True when a rank is drawn with rank letters rather than suit pips. */
export function isHonourRank(rank: string): rank is HonourRank {
  return HONOUR_RANK_SET.has(rank);
}

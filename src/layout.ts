/**
 * Card geometry, derived from the physical card size.
 *
 * One unit is 0.1 mm. The layout (columns and frame) is expressed in percentages
 * of the card, so it adapts to any size. The drawn elements - index glyphs, pips,
 * stroke and corner radii - keep a fixed physical size in millimetres, which is
 * what makes a bridge card and a poker card look like the same deck at different
 * cuts.
 */

export const UNITS_PER_MM = 10;

/** Physical card size in millimetres. */
export interface CardSize {
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface PipPlacement {
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
}

/** Everything the renderer needs to place one card. */
export interface CardGeometry {
  readonly size: CardSize;
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
  readonly columnWidths: readonly [number, number, number];
  readonly columnLefts: readonly [number, number, number];
  readonly columnCenters: readonly [number, number, number];
  readonly frameLeft: number;
  readonly frameRight: number;
  readonly frameTop: number;
  readonly frameBottom: number;
  readonly frameX: number;
  readonly frameY: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCornerRadius: number;
  readonly frameStrokeWidth: number;
  readonly indexRankHeight: number;
  readonly indexGap: number;
  readonly indexSuitHeight: number;
  readonly indexHeight: number;
  readonly indexCenterY: number;
  readonly indexTop: number;
  readonly indexBottom: number;
  readonly indexRankOffsetY: number;
  readonly indexSuitOffsetY: number;
  readonly centerPipHeight: number;
  readonly centerPipCenter: { readonly x: number; readonly y: number };
  readonly cornerPipHeight: number;
  readonly cornerPipCenters: readonly PipPlacement[];
  readonly pipFieldLeft: number;
  readonly pipFieldTop: number;
  readonly pipFieldWidth: number;
  readonly pipFieldHeight: number;
  readonly pipHeight: number;
  /**
   * Visible height of each letter of an honour pair: baseline to the top of the
   * capital, so letters with a descender (`J`, `Q`) are not shrunk to make room
   * for ink that hangs below the line.
   */
  readonly honourLetterCap: number;
  /** Center x of the two stacked letters of an honour pair. */
  readonly honourLetterX: number;
  /**
   * Clear space between an honour letter and the rule it faces, measured from the
   * lowest point of that letter's own ink. Measuring from the ink and not from the
   * cap box is what lets the pair sit close to the line: a letter with a descender
   * (`J`, `Q`) is lifted by what it hangs below the baseline, so it clears the rule
   * while `A` and `K` stay on it.
   */
  readonly honourLetterGap: number;
  readonly honourRuleWidth: number;
  readonly honourRuleThickness: number;
  readonly honourRuleY: number;
  readonly jumboMaxWidth: number;
  readonly jumboMaxHeight: number;
}

/** Column widths as fractions of the card width: 20% / 60% / 20%. */
export const COLUMN_FRACTIONS = [0.2, 0.6, 0.2] as const;

/** The middle column frame starts 20% in from every edge of the card. */
export const FRAME_INSET = 0.2;

/**
 * Height of a suit symbol, in millimetres.
 *
 * Every suit on the card is drawn at this height: the symbol of the index in
 * columns 1 and 3, the four corner pips and the pips of a traditional pattern.
 * A suit keeps its own aspect ratio, so the four colors differ in width - which
 * is what makes them recognizable - but never in size.
 */
const SUIT_HEIGHT_MM = 7;

/** Fixed physical sizes, in millimetres. */
const MM = {
  cardCornerRadius: 3,
  frameCornerRadius: 2,
  frameStroke: 1.5,
  /** The index letter is set to the height of the suit below it. */
  indexRank: SUIT_HEIGHT_MM,
  indexGap: 0.8,
  centerPip: 26.4,
  cornerPipInset: 6.5,
  jumboInset: 2,
  honourRule: 1.5,
} as const;

/**
 * Honours (A, K, Q, J) in the `traditional` layout show a stacked pair of rank
 * letters split by a rule, instead of a suit symbol. Both letters share one cap
 * height so the pair reads as a single mark, and each of them is set on the rule
 * the way a letter sits on a writing line: `HONOUR_LETTER_GAP_FRACTION` of the
 * cap height stays clear between the ink and the rule.
 */
const HONOUR_LETTER_FRACTION = 0.24;
const HONOUR_LETTER_GAP_FRACTION = 0.12;
const HONOUR_RULE_WIDTH_FRACTION = 0.5;

function triple(values: readonly number[]): readonly [number, number, number] {
  return [values[0]!, values[1]!, values[2]!];
}

/** Builds the full layout for a card of the given physical size. */
export function cardGeometry(size: CardSize): CardGeometry {
  const width = size.widthMm * UNITS_PER_MM;
  const height = size.heightMm * UNITS_PER_MM;

  const columnWidths = triple(
    COLUMN_FRACTIONS.map((fraction) => fraction * width),
  );
  const [firstColumn, middleColumn] = columnWidths;
  const columnLefts: readonly [number, number, number] = [
    0,
    firstColumn,
    firstColumn + middleColumn,
  ];
  const columnCenters = triple(
    columnLefts.map((left, index) => left + columnWidths[index]! / 2),
  );

  const frameLeft = FRAME_INSET * width;
  const frameRight = (1 - FRAME_INSET) * width;
  const frameTop = FRAME_INSET * height;
  const frameBottom = (1 - FRAME_INSET) * height;
  const frameStrokeWidth = MM.frameStroke * UNITS_PER_MM;
  const frameCornerRadius = MM.frameCornerRadius * UNITS_PER_MM;

  // The frame path *is* the middle column outline, so the stroke straddles it.
  const frameX = frameLeft;
  const frameY = frameTop;
  const frameWidth = frameRight - frameLeft;
  const frameHeight = frameBottom - frameTop;

  const indexRankHeight = MM.indexRank * UNITS_PER_MM;
  const suitHeight = SUIT_HEIGHT_MM * UNITS_PER_MM;
  const indexGap = MM.indexGap * UNITS_PER_MM;
  // The suit symbol is rendered at the same height as the rank.
  const indexSuitHeight = suitHeight;
  const indexHeight = indexRankHeight + indexGap + indexSuitHeight;
  // Centered in the *visible* band, so the frame stroke is excluded.
  const indexCenterY = (frameTop - frameStrokeWidth / 2) / 2;
  const indexTop = indexCenterY - indexHeight / 2;
  const indexBottom = indexCenterY + indexHeight / 2;
  const indexRankOffsetY = indexRankHeight / 2 - indexHeight / 2;
  const indexSuitOffsetY =
    indexRankHeight + indexGap + indexSuitHeight / 2 - indexHeight / 2;

  const centerPipHeight = MM.centerPip * UNITS_PER_MM;
  const cornerPipHeight = suitHeight;
  const cornerPipInset = MM.cornerPipInset * UNITS_PER_MM;
  const cornerPipCenters: readonly PipPlacement[] = [
    {
      x: frameLeft + cornerPipInset,
      y: frameTop + cornerPipInset,
      rotated: false,
    },
    {
      x: frameRight - cornerPipInset,
      y: frameTop + cornerPipInset,
      rotated: false,
    },
    {
      x: frameLeft + cornerPipInset,
      y: frameBottom - cornerPipInset,
      rotated: true,
    },
    {
      x: frameRight - cornerPipInset,
      y: frameBottom - cornerPipInset,
      rotated: true,
    },
  ];

  const jumboInset = MM.jumboInset * UNITS_PER_MM;
  const jumboMaxWidth = frameWidth - frameStrokeWidth - 2 * jumboInset;
  const jumboMaxHeight = frameHeight - frameStrokeWidth - 2 * jumboInset;

  // The area inside the frame stroke that the traditional patterns fill.
  const pipFieldLeft = frameLeft + frameStrokeWidth / 2;
  const pipFieldTop = frameTop + frameStrokeWidth / 2;
  const pipFieldWidth = frameWidth - frameStrokeWidth;
  const pipFieldHeight = frameHeight - frameStrokeWidth;
  // The pips of a pattern are the same size as the suit of the index, so one
  // suit is one size wherever it appears on the card.
  const pipHeight = suitHeight;

  // The stacked letter pair for the honours, mirrored about the card center.
  // Where the two letters sit depends on how far the font drops ink below the
  // baseline, so only the shared size, the axis and the gap are derived here.
  const honourLetterCap = HONOUR_LETTER_FRACTION * pipFieldHeight;
  const honourLetterGap = HONOUR_LETTER_GAP_FRACTION * honourLetterCap;
  const honourLetterX = pipFieldLeft + pipFieldWidth / 2;
  const honourRuleWidth = HONOUR_RULE_WIDTH_FRACTION * pipFieldWidth;
  const honourRuleThickness = MM.honourRule * UNITS_PER_MM;
  const honourRuleY = pipFieldTop + pipFieldHeight / 2;

  return {
    size,
    width,
    height,
    cornerRadius: MM.cardCornerRadius * UNITS_PER_MM,
    columnWidths,
    columnLefts,
    columnCenters,
    frameLeft,
    frameRight,
    frameTop,
    frameBottom,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    frameCornerRadius,
    frameStrokeWidth,
    indexRankHeight,
    indexGap,
    indexSuitHeight,
    indexHeight,
    indexCenterY,
    indexTop,
    indexBottom,
    indexRankOffsetY,
    indexSuitOffsetY,
    centerPipHeight,
    centerPipCenter: { x: columnCenters[1]!, y: height / 2 },
    cornerPipHeight,
    cornerPipCenters,
    pipFieldLeft,
    pipFieldTop,
    pipFieldWidth,
    pipFieldHeight,
    pipHeight,
    honourLetterCap,
    honourLetterX,
    honourLetterGap,
    honourRuleWidth,
    honourRuleThickness,
    honourRuleY,
    jumboMaxWidth,
    jumboMaxHeight,
  };
}

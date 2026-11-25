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
  readonly jumboMaxWidth: number;
  readonly jumboMaxHeight: number;
}

/** Column widths as fractions of the card width: 20% / 60% / 20%. */
export const COLUMN_FRACTIONS = [0.2, 0.6, 0.2] as const;

/** The middle column frame starts 20% in from every edge of the card. */
export const FRAME_INSET = 0.2;

/** Fixed physical sizes, in millimetres. */
const MM = {
  cardCornerRadius: 3,
  frameCornerRadius: 2,
  frameStroke: 1.5,
  indexRank: 7,
  indexGap: 0.8,
  centerPip: 26.4,
  cornerPip: 7,
  cornerPipInset: 6.5,
  jumboInset: 2,
} as const;

/**
 * Traditional pip sizing.
 *
 * One pip gets one cell of the densest grid the patterns use: the side columns
 * of ranks 9 and 10 step every quarter of the field width and every eighth of
 * its height. Sizing from that cell keeps every rank on one pip size, the way a
 * printed deck does, and guarantees that a pip never reaches a diagonal
 * neighbour. A twelfth of the cell stays clear.
 */
const PIP_PITCH_FILL = 11 / 12;

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
  const indexGap = MM.indexGap * UNITS_PER_MM;
  // The suit symbol is rendered at the same height as the rank.
  const indexSuitHeight = indexRankHeight;
  const indexHeight = indexRankHeight + indexGap + indexSuitHeight;
  // Centered in the *visible* band, so the frame stroke is excluded.
  const indexCenterY = (frameTop - frameStrokeWidth / 2) / 2;
  const indexTop = indexCenterY - indexHeight / 2;
  const indexBottom = indexCenterY + indexHeight / 2;
  const indexRankOffsetY = indexRankHeight / 2 - indexHeight / 2;
  const indexSuitOffsetY =
    indexRankHeight + indexGap + indexSuitHeight / 2 - indexHeight / 2;

  const centerPipHeight = MM.centerPip * UNITS_PER_MM;
  const cornerPipHeight = MM.cornerPip * UNITS_PER_MM;
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
  const pipHeight =
    Math.min(pipFieldWidth / 4, pipFieldHeight / 8) * PIP_PITCH_FILL;

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
    jumboMaxWidth,
    jumboMaxHeight,
  };
}

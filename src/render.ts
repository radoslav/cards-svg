import { glyphById, type Glyph, type GlyphId } from "./glyphs.ts";
import { cardGeometry, type CardGeometry, type CardSize } from "./layout.ts";
import { isPipRank, PIP_LAYOUTS, type PipRank } from "./pips.ts";
import {
  COLOR_BACKGROUND,
  defaultColor,
  glyphIdFor,
  RANK_GLYPH_ID,
  type CardLayout,
  type Rank,
  type Suit,
  type SuitStyle,
} from "./suits.ts";
import { format, round, serialize, type Node } from "./svg.ts";

export interface CardSpec {
  readonly suit: Suit;
  readonly rank: Rank;
  /** Glyph style. Defaults to solid symbols. */
  readonly style?: SuitStyle;
  /**
   * Middle column layout. `standard` draws one large pip plus four corner pips,
   * `jumbo` draws a single oversized pip, and `traditional` draws the pip
   * pattern of the rank (falling back to `standard` for the ace and the face
   * cards). Defaults to `standard`.
   */
  readonly layout?: CardLayout;
  /** Physical card size. Defaults to the bridge size (57 x 89 mm). */
  readonly size?: CardSize;
  /** Foreground color. Defaults to red for hearts/diamonds, black otherwise. */
  readonly color?: string;
  /** Pretty-print the document with newlines and indentation. Defaults to true. */
  readonly pretty?: boolean;
}

/** Default physical size: the bridge card, matching `DECKS.bridge`. */
export const DEFAULT_CARD_SIZE: CardSize = { widthMm: 57, heightMm: 89 };

/**
 * Scales keep more decimals than coordinates: a scale is multiplied by source
 * glyph offsets of several hundred units, so rounding it early shifts the glyph.
 */
const SCALE_PRECISION = 6;

/** Identifiers used inside the generated document. */
const PIP_ID = "pip";
const RANK_ID = "rank";
const INDEX_ID = "index";

/** A glyph together with the id it is declared under in `<defs>`. */
interface GlyphRef {
  readonly glyph: Glyph;
  readonly id: string;
}

function requireGlyph(id: GlyphId): Glyph {
  const glyph = glyphById(id);
  if (!glyph) {
    throw new Error(`missing glyph "${id}" - regenerate src/glyphs.ts`);
  }
  return glyph;
}

/**
 * Transform that scales a glyph to `height` units and centers its bounding box
 * on (cx, cy), optionally rotated 180 degrees around that same point.
 *
 * The two source-space translations are folded into one so each coordinate is
 * rounded once instead of twice.
 */
function glyphTransform(
  glyph: Glyph,
  height: number,
  cx: number,
  cy: number,
  rotated: boolean,
): string {
  // Round the scale first: the folded translate below is multiplied by it, so
  // deriving it from an unrounded scale would amplify the output rounding.
  const scale = round(height / glyph.height, SCALE_PRECISION);
  const originX = scale * (glyph.x + glyph.width / 2);
  const originY = scale * (glyph.y + glyph.height / 2);
  const [tx, ty] = rotated
    ? [cx + originX, cy + originY]
    : [cx - originX, cy - originY];
  const rotate = rotated ? " rotate(180)" : "";
  return `translate(${format(tx)} ${format(ty)})${rotate} scale(${format(scale, SCALE_PRECISION)})`;
}

/** Reference to a glyph already declared in `<defs>`. */
function glyphUse(
  ref: GlyphRef,
  height: number,
  cx: number,
  cy: number,
  rotated = false,
): Node {
  return {
    tag: "use",
    attributes: {
      href: `#${ref.id}`,
      transform: glyphTransform(ref.glyph, height, cx, cy, rotated),
    },
  };
}

/** Height that fits a glyph inside a box while keeping its aspect ratio. */
function fitGlyphHeight(
  glyph: Glyph,
  maxWidth: number,
  maxHeight: number,
): number {
  return Math.min(maxHeight, maxWidth * (glyph.height / glyph.width));
}

/** Glyph paths shared by every placement, declared once. */
function glyphDefinitions(refs: readonly GlyphRef[]): Node[] {
  return refs.map((ref) => ({
    tag: "path",
    attributes: { id: ref.id, d: ref.glyph.d },
  }));
}

/** Index block: rank above suit symbol, centered on the local origin. */
function indexBlock(pip: GlyphRef, rank: GlyphRef, geo: CardGeometry): Node {
  return {
    tag: "g",
    attributes: { id: INDEX_ID },
    children: [
      glyphUse(rank, geo.indexRankHeight, 0, geo.indexRankOffsetY),
      glyphUse(pip, geo.indexSuitHeight, 0, geo.indexSuitOffsetY),
    ],
  };
}

function frameNode(geo: CardGeometry, color: string): Node {
  return {
    tag: "rect",
    attributes: {
      x: format(geo.frameX),
      y: format(geo.frameY),
      width: format(geo.frameWidth),
      height: format(geo.frameHeight),
      rx: format(geo.frameCornerRadius),
      fill: "none",
      stroke: color,
      "stroke-width": format(geo.frameStrokeWidth),
    },
  };
}

/** Pips for the middle column, chosen by layout. */
function middlePips(
  pip: GlyphRef,
  layout: CardLayout,
  rank: Rank,
  geo: CardGeometry,
): Node[] {
  const center = geo.centerPipCenter;
  if (layout === "jumbo") {
    const height = fitGlyphHeight(
      pip.glyph,
      geo.jumboMaxWidth,
      geo.jumboMaxHeight,
    );
    return [glyphUse(pip, height, center.x, center.y)];
  }
  if (layout === "traditional" && isPipRank(rank)) {
    return pipFieldPips(pip, rank, geo);
  }
  return [
    glyphUse(pip, geo.centerPipHeight, center.x, center.y),
    ...geo.cornerPipCenters.map((placement) =>
      glyphUse(
        pip,
        geo.cornerPipHeight,
        placement.x,
        placement.y,
        placement.rotated,
      ),
    ),
  ];
}

/**
 * The traditional pip pattern of a numeric rank: every slot of the pattern
 * resolved against the pip field, with the lower half turned upside down.
 */
function pipFieldPips(pip: GlyphRef, rank: PipRank, geo: CardGeometry): Node[] {
  return PIP_LAYOUTS[rank].map((slot) =>
    glyphUse(
      pip,
      geo.pipHeight,
      geo.pipFieldLeft + slot.fx * geo.pipFieldWidth,
      geo.pipFieldTop + slot.fy * geo.pipFieldHeight,
      slot.fy > 1 / 2,
    ),
  );
}

function middleColumn(
  pip: GlyphRef,
  layout: CardLayout,
  rank: Rank,
  geo: CardGeometry,
  color: string,
): Node {
  return {
    tag: "g",
    attributes: { fill: color },
    children: [frameNode(geo, color), ...middlePips(pip, layout, rank, geo)],
  };
}

function backgroundNode(geo: CardGeometry): Node {
  return {
    tag: "rect",
    attributes: {
      width: format(geo.width),
      height: format(geo.height),
      rx: format(geo.cornerRadius),
      fill: COLOR_BACKGROUND,
    },
  };
}

/** The index placed at the top of column 1 and, rotated, at the bottom of column 3. */
function indexUses(geo: CardGeometry, color: string): Node[] {
  const fill = { fill: color };
  const [firstColumn, , lastColumn] = geo.columnCenters;
  return [
    {
      tag: "use",
      attributes: {
        ...fill,
        href: `#${INDEX_ID}`,
        transform: `translate(${format(firstColumn)} ${format(geo.indexCenterY)})`,
      },
    },
    {
      tag: "use",
      attributes: {
        ...fill,
        href: `#${INDEX_ID}`,
        transform:
          `translate(${format(lastColumn)} ${format(geo.height - geo.indexCenterY)})` +
          " rotate(180)",
      },
    },
  ];
}

/** Renders a single bridge card as a standalone SVG document. */
export function renderCard(spec: CardSpec): string {
  const style = spec.style ?? "solid";
  const layout = spec.layout ?? "standard";
  const color = spec.color ?? defaultColor(spec.suit);
  const pretty = spec.pretty ?? true;
  const geo = cardGeometry(spec.size ?? DEFAULT_CARD_SIZE);

  const pip: GlyphRef = {
    glyph: requireGlyph(glyphIdFor(spec.suit, style)),
    id: PIP_ID,
  };
  const rank: GlyphRef = {
    glyph: requireGlyph(RANK_GLYPH_ID[spec.rank]),
    id: RANK_ID,
  };

  const root: Node = {
    tag: "svg",
    attributes: {
      xmlns: "http://www.w3.org/2000/svg",
      width: `${geo.size.widthMm}mm`,
      height: `${geo.size.heightMm}mm`,
      viewBox: `0 0 ${format(geo.width)} ${format(geo.height)}`,
    },
    children: [
      {
        tag: "defs",
        attributes: {},
        children: [
          ...glyphDefinitions([pip, rank]),
          indexBlock(pip, rank, geo),
        ],
      },
      backgroundNode(geo),
      middleColumn(pip, layout, spec.rank, geo, color),
      ...indexUses(geo, color),
    ],
  };

  const document = serialize(root, pretty);
  return pretty ? `${document}\n` : document;
}

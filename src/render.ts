import {
  DEFAULT_FONT,
  fontSet,
  capHeight,
  type FontName,
  type Glyph,
  type GlyphId,
  type GlyphSet,
} from "./glyphs.ts";
import { cardGeometry, type CardGeometry, type CardSize } from "./layout.ts";
import {
  HONOUR_RANKS,
  isHonourRank,
  isPipRank,
  PIP_LAYOUTS,
  type PipRank,
} from "./pips.ts";
import {
  COLOR_BACKGROUND,
  defaultColor,
  DEFAULT_LAYOUT,
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
   * cards). Defaults to `DEFAULT_LAYOUT`.
   */
  readonly layout?: CardLayout;
  /** Physical card size. Defaults to the bridge size (57 x 89 mm). */
  readonly size?: CardSize;
  /** Foreground color. Defaults to red for hearts/diamonds, black otherwise. */
  readonly color?: string;
  /**
   * Vectorized font set for the rank and suit glyphs. Defaults to
   * `DEFAULT_FONT`; every registered font covers every rank and suit.
   */
  readonly font?: FontName;
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

/**
 * A glyph from a resolved set. `GlyphSet` is exhaustive, so a miss means the
 * generated set is stale rather than that the id is unknown.
 */
function requireGlyph(glyphs: GlyphSet, id: GlyphId): Glyph {
  const glyph = glyphs[id];
  if (!glyph) {
    throw new Error(`missing glyph "${id}" - regenerate src/fonts/`);
  }
  return glyph;
}

/**
 * Transform that places a glyph scaled by `scale` so that the source-space point
 * `origin` lands on (cx, cy), optionally rotated 180 degrees around that point.
 *
 * The two source-space translations are folded into one so each coordinate is
 * rounded once instead of twice.
 */
function placeGlyph(
  scale: number,
  origin: readonly [number, number],
  cx: number,
  cy: number,
  rotated: boolean,
): string {
  const originX = scale * origin[0];
  const originY = scale * origin[1];
  const [tx, ty] = rotated
    ? [cx + originX, cy + originY]
    : [cx - originX, cy - originY];
  const rotate = rotated ? " rotate(180)" : "";
  return `translate(${format(tx)} ${format(ty)})${rotate} scale(${format(scale, SCALE_PRECISION)})`;
}

/** The center of a glyph's bounding box, in source units. */
function boxCenter(glyph: Glyph): readonly [number, number] {
  return [glyph.x + glyph.width / 2, glyph.y + glyph.height / 2];
}

/**
 * The scale that makes a source-space height read as `height` units.
 *
 * Rounded before it is used: the folded translate is multiplied by it, so
 * deriving that translate from an unrounded scale would amplify the rounding of
 * the output coordinates.
 */
function scaleTo(height: number, sourceHeight: number): number {
  return round(height / sourceHeight, SCALE_PRECISION);
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
      transform: placeGlyph(
        scaleTo(height, ref.glyph.height),
        boxCenter(ref.glyph),
        cx,
        cy,
        rotated,
      ),
    },
  };
}

/**
 * A rank letter scaled to `cap` units of visible height and centered on its ink.
 *
 * The two are deliberately different boxes. The scale comes from the cap height,
 * which is what makes `A`, `K`, `Q` and `J` read as one type size. The center
 * comes from the bounding box, because the ink below the baseline of `J` and `Q`
 * is part of the letter a reader sees: centering the cap box instead lets that
 * descender hang toward the frame, so the letter looks oversized next to `A`.
 */
function letterUse(
  ref: GlyphRef,
  cap: number,
  cx: number,
  cy: number,
  rotated = false,
): Node {
  return {
    tag: "use",
    attributes: {
      href: `#${ref.id}`,
      transform: placeGlyph(
        scaleTo(cap, capHeight(ref.glyph)),
        boxCenter(ref.glyph),
        cx,
        cy,
        rotated,
      ),
    },
  };
}

/** The largest scale at which a glyph fits a box, keeping its aspect ratio. */
function fitScale(glyph: Glyph, maxWidth: number, maxHeight: number): number {
  return Math.min(maxWidth / glyph.width, maxHeight / glyph.height);
}

/** Height that fits a glyph inside a box while keeping its aspect ratio. */
function fitGlyphHeight(
  glyph: Glyph,
  maxWidth: number,
  maxHeight: number,
): number {
  return fitScale(glyph, maxWidth, maxHeight) * glyph.height;
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

/** The four corner pips, the lower pair turned upside down. */
function cornerPips(pip: GlyphRef, geo: CardGeometry): Node[] {
  return geo.cornerPipCenters.map((placement) =>
    glyphUse(
      pip,
      geo.cornerPipHeight,
      placement.x,
      placement.y,
      placement.rotated,
    ),
  );
}

/**
 * One cap height for every honour letter in the `jumbo` layout.
 *
 * Fitting each letter on its own lets a narrow letter such as `J` grow to the
 * full frame height while a wide one such as `A` is stopped by the frame width,
 * so the honours come out at wildly different sizes. The letters are compared by
 * cap height, not bounding box: `J` and `Q` ink below the baseline, so boxes of
 * one height make them read smaller than `A` or `K`. The smallest of the
 * per-letter fits is the largest cap height every one of them fits at, so
 * sharing it puts the honours on a single type size, the way a printed deck
 * sets them.
 */
function jumboHonourCap(glyphs: GlyphSet, geo: CardGeometry): number {
  return Math.min(
    ...HONOUR_RANKS.map((rank) => {
      const glyph = glyphs[RANK_GLYPH_ID[rank]];
      return (
        fitScale(glyph, geo.jumboMaxWidth, geo.jumboMaxHeight) *
        capHeight(glyph)
      );
    }),
  );
}

/** The oversized rank letter of a `jumbo` honour. */
function jumboLetter(ref: GlyphRef, geo: CardGeometry, cap: number): Node {
  const center = geo.centerPipCenter;
  return letterUse(ref, cap, center.x, center.y);
}

/** The oversized suit symbol of a `jumbo` numeric rank. */
function jumboPip(ref: GlyphRef, geo: CardGeometry): Node {
  const center = geo.centerPipCenter;
  return glyphUse(
    ref,
    fitGlyphHeight(ref.glyph, geo.jumboMaxWidth, geo.jumboMaxHeight),
    center.x,
    center.y,
  );
}

/** Pips for the middle column, chosen by layout. */
function middlePips(
  pip: GlyphRef,
  rankGlyph: GlyphRef,
  layout: CardLayout,
  rank: Rank,
  geo: CardGeometry,
  honourCap: number,
): Node[] {
  const center = geo.centerPipCenter;
  if (layout === "jumbo") {
    // An honour has no pip count, so the oversized mark is its own letter.
    if (isHonourRank(rank)) {
      return [jumboLetter(rankGlyph, geo, honourCap)];
    }
    return [jumboPip(pip, geo)];
  }
  if (layout === "traditional" && isPipRank(rank)) {
    return pipFieldPips(pip, rank, geo);
  }
  if (layout === "traditional" && isHonourRank(rank)) {
    // The large center symbol becomes the stacked letter pair; the corner pips
    // stay, so the card still reads as its suit at a glance.
    return [...honourPair(rankGlyph, geo), ...cornerPips(pip, geo)];
  }
  return [
    glyphUse(pip, geo.centerPipHeight, center.x, center.y),
    ...cornerPips(pip, geo),
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

/** The rule drawn between the two letters of an honour pair. */
function honourRule(geo: CardGeometry): Node {
  return {
    tag: "rect",
    attributes: {
      x: format(geo.centerPipCenter.x - geo.honourRuleWidth / 2),
      y: format(geo.honourRuleY - geo.honourRuleThickness / 2),
      width: format(geo.honourRuleWidth),
      height: format(geo.honourRuleThickness),
    },
  };
}

/**
 * A letter of an honour pair, set on the rule the way a letter sits on a writing
 * line: `edge` is the side of the rule the letter faces and the lowest point of
 * its ink stops `honourLetterGap` above it. Anchoring on the ink and not on the
 * cap box is what lets the pair sit close to the rule without `J` and `Q`
 * dragging a descender across it while `A` and `K` float above it.
 */
function letterOnRule(
  ref: GlyphRef,
  geo: CardGeometry,
  edge: number,
  rotated: boolean,
): Node {
  const glyph = ref.glyph;
  // The anchor is the bottom of the ink box, which for a letter with a descender
  // is below the baseline. The horizontal center of the box keeps the letter on
  // the axis of the pair.
  const anchor: readonly [number, number] = [
    glyph.x + glyph.width / 2,
    glyph.y + glyph.height,
  ];
  return {
    tag: "use",
    attributes: {
      href: `#${ref.id}`,
      transform: placeGlyph(
        scaleTo(geo.honourLetterCap, capHeight(glyph)),
        anchor,
        geo.honourLetterX,
        edge,
        rotated,
      ),
    },
  };
}

/**
 * An honour in the `traditional` layout: the rank letter stacked twice about
 * the middle line, split by a rule, the lower letter turned upside down.
 */
function honourPair(rank: GlyphRef, geo: CardGeometry): Node[] {
  const ruleTop = geo.honourRuleY - geo.honourRuleThickness / 2;
  const ruleBottom = geo.honourRuleY + geo.honourRuleThickness / 2;
  return [
    letterOnRule(rank, geo, ruleTop - geo.honourLetterGap, false),
    honourRule(geo),
    letterOnRule(rank, geo, ruleBottom + geo.honourLetterGap, true),
  ];
}

function middleColumn(
  pip: GlyphRef,
  rankGlyph: GlyphRef,
  layout: CardLayout,
  rank: Rank,
  geo: CardGeometry,
  color: string,
  honourCap: number,
): Node {
  return {
    tag: "g",
    attributes: { fill: color },
    children: [
      frameNode(geo, color),
      ...middlePips(pip, rankGlyph, layout, rank, geo, honourCap),
    ],
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
  const layout = spec.layout ?? DEFAULT_LAYOUT;
  const color = spec.color ?? defaultColor(spec.suit);
  const pretty = spec.pretty ?? true;
  const geo = cardGeometry(spec.size ?? DEFAULT_CARD_SIZE);
  const glyphs = fontSet(spec.font ?? DEFAULT_FONT);

  const pip: GlyphRef = {
    glyph: requireGlyph(glyphs, glyphIdFor(spec.suit, style)),
    id: PIP_ID,
  };
  const rank: GlyphRef = {
    glyph: requireGlyph(glyphs, RANK_GLYPH_ID[spec.rank]),
    id: RANK_ID,
  };
  // Shared by the honours so their oversized letters keep one type size.
  const honourCap = jumboHonourCap(glyphs, geo);

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
      middleColumn(pip, rank, layout, spec.rank, geo, color, honourCap),
      ...indexUses(geo, color),
    ],
  };

  const document = serialize(root, pretty);
  return pretty ? `${document}\n` : document;
}

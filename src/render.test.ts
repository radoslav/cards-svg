import { describe, expect, test } from "bun:test";
import { DEFAULT_CARD_SIZE, renderCard } from "./render.ts";
import {
  DEFAULT_FONT,
  FONT_NAMES,
  FONT_SETS,
  GLYPHS,
  capHeight,
  type Glyph,
} from "./glyphs.ts";
import {
  CARD_LAYOUTS,
  COLOR_BLACK,
  COLOR_RED,
  DEFAULT_LAYOUT,
  RANK_GLYPH_ID,
  SUIT_ORDER,
  type Rank,
  type Suit,
} from "./suits.ts";
import { DECKS } from "./decks.ts";
import { HONOUR_RANKS } from "./pips.ts";
import { cardGeometry, type CardGeometry } from "./layout.ts";

/** A `<use>` reference: which shared glyph it points at, and its transform. */
interface Placement {
  readonly href: string;
  readonly transform: string;
}

function placements(svg: string): Placement[] {
  return [...svg.matchAll(/<use\b([^>]*)/g)].map((match) => {
    const attrs = match[1] ?? "";
    const href = /href="#([\w-]+)"/.exec(attrs)?.[1] ?? "";
    const transform = /transform="([^"]*)"/.exec(attrs)?.[1] ?? "";
    return { href, transform };
  });
}

/** The middle column group only - everything after `</defs>`. */
function middleColumnGroup(svg: string): string {
  const afterDefs = svg.slice(svg.indexOf("</defs>"));
  return afterDefs.slice(afterDefs.indexOf("<g "), afterDefs.indexOf("</g>"));
}

/** Pip references inside the middle column. */
function middleColumnPips(svg: string): Placement[] {
  return placements(middleColumnGroup(svg));
}

/** Maps the ids declared in `<defs>` back to their glyph data. */
function glyphDefs(svg: string): Map<string, Glyph> {
  const byPath = new Map<string, Glyph>(
    Object.values(GLYPHS).map((glyph) => [glyph.d, glyph]),
  );
  const defs = new Map<string, Glyph>();
  for (const match of svg.matchAll(/<path id="([\w-]+)" d="([^"]*)"/g)) {
    const glyph = byPath.get(match[2] ?? "");
    if (glyph) {
      defs.set(match[1] ?? "", glyph);
    }
  }
  return defs;
}

function translateOf(transform: string): { x: number; y: number } {
  const match = /translate\((-?[\d.]+)[ ,]+(-?[\d.]+)\)/.exec(transform);
  if (!match) {
    throw new Error(`no translate in "${transform}"`);
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

function countElements(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag}(?=[\\s>/])`, "g")) ?? []).length;
}

/** Cheap structural check: every opened element is closed in order. */
function assertWellFormed(svg: string): void {
  const tagPattern = /<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  let seen = 0;
  while ((match = tagPattern.exec(svg)) !== null) {
    seen += 1;
    const closing = match[1] === "/";
    const name = match[2] ?? "";
    const selfClosing = match[4] === "/";
    if (closing) {
      expect(stack.pop(), `unexpected closing tag </${name}>`).toBe(name);
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  expect(seen).toBeGreaterThan(0);
  expect(stack).toEqual([]);
}

/** Reads the uniform scale factor out of a transform. */
function scaleOf(transform: string): number {
  const scale = /scale\(([\d.]+)\)/.exec(transform)?.[1];
  if (!scale) {
    throw new Error(`no scale in "${transform}"`);
  }
  return Number(scale);
}

/** Applies an SVG transform list to a point, in SVG order. */
function applyTransform(
  transform: string,
  point: { x: number; y: number },
): { x: number; y: number } {
  let { x, y } = point;
  const parts = [...transform.matchAll(/(translate|rotate|scale)\(([^)]*)\)/g)];
  // Rightmost function applies first.
  for (const part of parts.reverse()) {
    const kind = part[1];
    const args = (part[2] ?? "").split(/[ ,]+/).map(Number);
    if (kind === "scale") {
      x *= args[0]!;
      y *= args[0]!;
    } else if (kind === "rotate") {
      const angle = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.round(Math.cos(angle));
      const sin = Math.round(Math.sin(angle));
      [x, y] = [x * cos - y * sin, x * sin + y * cos];
    } else if (kind === "translate") {
      x += args[0] ?? 0;
      y += args[1] ?? 0;
    }
  }
  return { x, y };
}

/**
 * Where a `<use>` lands the center of its glyph: the transform maps the glyph's
 * own source center, so the translate alone is not the answer.
 */
function pipCenter(
  svg: string,
  placement: Placement,
): { x: number; y: number } {
  const glyph = glyphDefs(svg).get(placement.href);
  if (!glyph) {
    throw new Error(`glyph "${placement.href}" is not declared in defs`);
  }
  return applyTransform(placement.transform, {
    x: glyph.x + glyph.width / 2,
    y: glyph.y + glyph.height / 2,
  });
}

/**
 * The vertical span a letter actually occupies in card coordinates: `cap` is the
 * visible capital (baseline to its top), `ink` the whole bounding box, which for
 * `J` and `Q` reaches below the baseline. Rotation is folded in, so the span of
 * an upside-down letter comes out the right way round.
 */
function letterSpan(
  svg: string,
  placement: Placement,
): { cap: [number, number]; ink: [number, number] } {
  const glyph = glyphDefs(svg).get(placement.href);
  if (!glyph) {
    throw new Error(`glyph "${placement.href}" is not declared in defs`);
  }
  const at = (y: number): number =>
    applyTransform(placement.transform, { x: glyph.x, y }).y;
  const pair = (a: number, b: number): [number, number] =>
    a < b ? [a, b] : [b, a];
  return {
    cap: pair(at(glyph.y), at(glyph.baseline)),
    ink: pair(at(glyph.y), at(glyph.y + glyph.height)),
  };
}

// Single-card default size, which is what the specs below render with.
const geo: CardGeometry = cardGeometry(DEFAULT_CARD_SIZE);

describe("document shell", () => {
  const svg = renderCard({ suit: "diamonds", rank: "A" });

  test("declares millimetre size and a tenth-of-a-millimetre viewBox", () => {
    expect(svg).toContain(`width="${geo.size.widthMm}mm"`);
    expect(svg).toContain(`height="${geo.size.heightMm}mm"`);
    expect(svg).toContain(`viewBox="0 0 ${geo.width} ${geo.height}"`);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test("is font independent - no text elements", () => {
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("font-family");
  });

  test("is well formed", () => {
    assertWellFormed(svg);
  });

  test("starts with the svg root and ends with the closing tag", () => {
    expect(svg.trimStart().startsWith("<svg ")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>"));
  });
});

describe("card structure", () => {
  const svg = renderCard({ suit: "diamonds", rank: "A", layout: "standard" });

  test("has a white rounded background", () => {
    expect(svg).toContain('fill="#FFFFFF"');
    expect(countElements(svg, "rect")).toBe(2);
  });

  test("declares each glyph path exactly once", () => {
    const paths = [...svg.matchAll(/<path\b([^>]*)/g)].map((m) => m[1] ?? "");
    expect(paths).toHaveLength(2);
    expect(paths.filter((a) => a.includes('id="pip"'))).toHaveLength(1);
    expect(paths.filter((a) => a.includes('id="rank"'))).toHaveLength(1);
  });

  test("defines the index once and reuses it twice", () => {
    expect(countElements(svg, "defs")).toBe(1);
    expect(svg.match(/id="index"/g)).toHaveLength(1);
    expect(placements(svg).filter((p) => p.href === "index")).toHaveLength(2);
  });

  test("draws one center pip and four corner pips", () => {
    expect(middleColumnPips(svg)).toHaveLength(5);
  });

  test("places the frame 20% in from every edge", () => {
    expect(svg).toContain(`x="${geo.frameX}"`);
    expect(svg).toContain(`y="${geo.frameY}"`);
    expect(svg).toContain(`width="${geo.frameWidth}"`);
    expect(svg).toContain(`height="${geo.frameHeight}"`);
  });

  test("rotates only the bottom corner pips", () => {
    const pips = middleColumnPips(svg);
    const rotated = pips.filter((p) => p.transform.includes("rotate(180)"));
    expect(rotated).toHaveLength(
      geo.cornerPipCenters.filter((pip) => pip.rotated).length,
    );
  });
});

describe("index placement", () => {
  const svg = renderCard({ suit: "diamonds", rank: "A" });
  const indexUses = placements(svg).filter((p) => p.href === "index");

  test("column 1 index is in the upper left", () => {
    expect(indexUses).toHaveLength(2);
    const [top] = indexUses;
    const translate = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(top!.transform);
    expect(Number(translate![1])).toBeLessThan(geo.width / 2);
    expect(Number(translate![2])).toBeLessThan(geo.height / 2);
  });

  test("column 3 index is the point reflection of column 1", () => {
    const points = indexUses.map((p) => {
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(p.transform);
      return { x: Number(m![1]), y: Number(m![2]) };
    });
    const [top, bottom] = points;
    expect(bottom!.x).toBeCloseTo(geo.width - top!.x, 3);
    expect(bottom!.y).toBeCloseTo(geo.height - top!.y, 3);
  });

  test("column 3 index is rotated", () => {
    expect(indexUses[0]!.transform).not.toContain("rotate(180)");
    expect(indexUses[1]!.transform).toContain("rotate(180)");
  });
});

describe("glyph placement math", () => {
  test("the folded transform lands the glyph center on its layout center", () => {
    const svg = renderCard({
      suit: "diamonds",
      rank: "A",
      layout: "standard",
    });
    const pip = glyphDefs(svg).get("pip");
    if (!pip) {
      throw new Error("pip glyph not declared in defs");
    }
    const sourceCenter = {
      x: pip.x + pip.width / 2,
      y: pip.y + pip.height / 2,
    };
    const expected = [geo.centerPipCenter, ...geo.cornerPipCenters];
    const pips = middleColumnPips(svg);
    expect(pips).toHaveLength(expected.length);
    for (const placement of pips) {
      const got = applyTransform(placement.transform, sourceCenter);
      const hit = expected.some(
        (want) =>
          Math.abs(got.x - want.x) < 0.01 && Math.abs(got.y - want.y) < 0.01,
      );
      expect(hit, `pip landed at ${got.x},${got.y}`).toBe(true);
    }
  });

  test("rotated pips turn about their own center", () => {
    const svg = renderCard({
      suit: "diamonds",
      rank: "A",
      layout: "standard",
    });
    const pip = glyphDefs(svg).get("pip")!;
    const sourceCenter = {
      x: pip.x + pip.width / 2,
      y: pip.y + pip.height / 2,
    };
    const rotated = middleColumnPips(svg).filter((p) =>
      p.transform.includes("rotate(180)"),
    );
    expect(rotated).toHaveLength(
      geo.cornerPipCenters.filter((p) => p.rotated).length,
    );
    for (const placement of rotated) {
      const center = applyTransform(placement.transform, sourceCenter);
      const bottom = geo.cornerPipCenters.filter((p) => p.rotated);
      const hit = bottom.some(
        (want) =>
          Math.abs(center.x - want.x) < 0.01 &&
          Math.abs(center.y - want.y) < 0.01,
      );
      expect(hit).toBe(true);
    }
  });
});

describe("colors", () => {
  test("uses red for diamonds and hearts", () => {
    expect(renderCard({ suit: "diamonds", rank: "A" })).toContain(COLOR_RED);
    expect(renderCard({ suit: "hearts", rank: "A" })).toContain(COLOR_RED);
  });

  test("uses black for spades and clubs", () => {
    expect(renderCard({ suit: "spades", rank: "A" })).toContain(COLOR_BLACK);
    expect(renderCard({ suit: "clubs", rank: "A" })).toContain(COLOR_BLACK);
  });

  test("can be overridden", () => {
    const svg = renderCard({ suit: "diamonds", rank: "A", color: "#00FF00" });
    expect(svg).toContain("#00FF00");
    expect(svg).not.toContain(COLOR_RED);
  });
});

describe("styles", () => {
  test("outlined uses the hollow glyphs", () => {
    const outlined = renderCard({
      suit: "diamonds",
      rank: "A",
      style: "outlined",
    });
    expect(outlined).toContain(`d="${GLYPHS.diamondsOutlined.d}"`);
    // The outlined outer contour is identical to the solid glyph, so whole
    // attributes must be compared rather than substrings.
    expect(outlined).not.toContain(`d="${GLYPHS.diamonds.d}"`);
  });

  test("solid is the default", () => {
    expect(renderCard({ suit: "clubs", rank: "A" })).toContain(
      `d="${GLYPHS.clubs.d}"`,
    );
  });

  test("every suit renders", () => {
    for (const suit of SUIT_ORDER) {
      const svg = renderCard({ suit, rank: "A", layout: "standard" });
      assertWellFormed(svg);
      expect(middleColumnPips(svg)).toHaveLength(5);
    }
  });
});

describe("jumbo layout", () => {
  const jumbo = renderCard({ suit: "diamonds", rank: "A", layout: "jumbo" });
  const standard = renderCard({ suit: "diamonds", rank: "A" });

  test("draws a single pip instead of five", () => {
    expect(middleColumnPips(jumbo)).toHaveLength(1);
    expect(countElements(jumbo, "rect")).toBe(2);
  });

  test("keeps the frame and both index columns", () => {
    expect(jumbo).toContain(`x="${geo.frameX}"`);
    expect(placements(jumbo).filter((p) => p.href === "index")).toHaveLength(2);
  });

  test("scales the symbol up well beyond the standard center pip", () => {
    const biggest = (svg: string): number =>
      Math.max(...middleColumnPips(svg).map((p) => scaleOf(p.transform)));
    expect(biggest(jumbo)).toBeGreaterThan(biggest(standard));
  });

  test("fits every suit inside the frame", () => {
    for (const suit of SUIT_ORDER) {
      // A numeric rank keeps the suit symbol as the oversized mark.
      const svg = renderCard({ suit, rank: "9", layout: "jumbo" });
      assertWellFormed(svg);
      const [pip] = middleColumnPips(svg);
      const scale = scaleOf(pip!.transform);
      const glyph = GLYPHS[suit];
      expect(glyph.height * scale).toBeLessThanOrEqual(
        geo.frameHeight - geo.frameStrokeWidth,
      );
      expect(glyph.width * scale).toBeLessThanOrEqual(
        geo.frameWidth - geo.frameStrokeWidth,
      );
    }
  });

  test("sets all honour letters at one cap height", () => {
    // A narrow letter such as J must not grow taller than a wide one such as A,
    // and a letter with a descender must not shrink to make up for it.
    const caps = HONOUR_RANKS.map((rank) => {
      const svg = renderCard({ suit: "spades", rank, layout: "jumbo" });
      const [mark] = middleColumnPips(svg);
      return scaleOf(mark!.transform) * capHeight(GLYPHS[RANK_GLYPH_ID[rank]]);
    });
    for (const cap of caps) {
      expect(cap).toBeCloseTo(caps[0]!, 3);
    }
    // Still an oversized mark, not shrunk down to the index size.
    expect(caps[0]!).toBeGreaterThan(geo.indexRankHeight);
  });

  test("honour letters fit the frame at the shared height", () => {
    for (const rank of HONOUR_RANKS) {
      const svg = renderCard({ suit: "clubs", rank, layout: "jumbo" });
      const [mark] = middleColumnPips(svg);
      const scale = scaleOf(mark!.transform);
      const glyph = GLYPHS[RANK_GLYPH_ID[rank]];
      expect(glyph.height * scale).toBeLessThanOrEqual(
        geo.frameHeight - geo.frameStrokeWidth,
      );
      expect(glyph.width * scale).toBeLessThanOrEqual(
        geo.frameWidth - geo.frameStrokeWidth,
      );
    }
  });

  test("centers each honour letter on its own ink", () => {
    // A descender is part of the letter a reader sees, so the ink has to be
    // centered, not the cap box: otherwise `J` hangs toward the bottom of the
    // frame and reads as a larger letter than `A`.
    for (const rank of HONOUR_RANKS) {
      const svg = renderCard({ suit: "spades", rank, layout: "jumbo" });
      const [mark] = middleColumnPips(svg);
      const span = letterSpan(svg, mark!);
      const above = span.ink[0] - (geo.frameTop - geo.frameStrokeWidth / 2);
      const below = geo.frameBottom + geo.frameStrokeWidth / 2 - span.ink[1];
      expect(above).toBeCloseTo(below, 1);
    }
  });

  test("is opt-in over the default layout", () => {
    expect(renderCard({ suit: "diamonds", rank: "A" })).not.toBe(jumbo);
    expect(
      renderCard({ suit: "diamonds", rank: "A", layout: "standard" }),
    ).not.toBe(jumbo);
  });

  test("combines with the outlined style", () => {
    const outlined = renderCard({
      suit: "diamonds",
      rank: "A",
      layout: "jumbo",
      style: "outlined",
    });
    expect(outlined).toContain(`d="${GLYPHS.diamondsOutlined.d}"`);
  });
});

describe("traditional layout", () => {
  /** The pip references of a traditionally laid out card. */
  function traditionalPips(suit: Suit, rank: Rank): Placement[] {
    return middleColumnPips(renderCard({ suit, rank, layout: "traditional" }));
  }

  /** Where every pip of a pattern actually lands, in card coordinates. */
  function pipCenters(suit: Suit, rank: Rank): { x: number; y: number }[] {
    const svg = renderCard({ suit, rank, layout: "traditional" });
    return middleColumnPips(svg).map((p) => pipCenter(svg, p));
  }

  test("draws the pip count of each numeric rank", () => {
    for (const rank of [
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ] as const) {
      expect(traditionalPips("hearts", rank)).toHaveLength(Number(rank));
    }
  });

  test("draws a stacked letter pair for the honours", () => {
    for (const rank of ["A", "K", "Q", "J"] as const) {
      const svg = renderCard({ suit: "clubs", rank, layout: "traditional" });
      assertWellFormed(svg);
      // Two letters plus the four corner pips; the rule is a rect, not a use.
      expect(middleColumnPips(svg)).toHaveLength(6);
      expect(svg).toContain(`d="${GLYPHS[RANK_GLYPH_ID[rank]].d}"`);
    }
  });

  test("sets the honour letters at one cap height", () => {
    // A letter with a descender must not read shorter than A or K, and both
    // letters of a pair must be the same size even though one is upside down.
    for (const rank of HONOUR_RANKS) {
      const svg = renderCard({ suit: "clubs", rank, layout: "traditional" });
      const glyph = GLYPHS[RANK_GLYPH_ID[rank]];
      const letters = middleColumnPips(svg).filter((p) => p.href === "rank");
      expect(letters).toHaveLength(2);
      const spans = letters.map((letter) => letterSpan(svg, letter));
      for (const letter of letters) {
        expect(scaleOf(letter.transform) * capHeight(glyph)).toBeCloseTo(
          geo.honourLetterCap,
          3,
        );
      }
      // Each letter is set on the rule: its own ink stops one gap away from the
      // side it faces, so a descender (J, Q) clears the rule while A and K do
      // not float. The upside-down letter mirrors the upright one about it.
      const [top, bottom] = spans;
      const ruleTop = geo.honourRuleY - geo.honourRuleThickness / 2;
      const ruleBottom = geo.honourRuleY + geo.honourRuleThickness / 2;
      expect(top!.cap[0]).toBeCloseTo(2 * geo.honourRuleY - bottom!.cap[1], 2);
      expect(ruleTop - top!.ink[1]).toBeCloseTo(geo.honourLetterGap, 1);
      expect(bottom!.ink[0] - ruleBottom).toBeCloseTo(geo.honourLetterGap, 1);
      expect(top!.ink[1]).toBeLessThan(ruleTop);
      expect(bottom!.ink[0]).toBeGreaterThan(ruleBottom);
    }
  });

  test("keeps the frame and both index columns", () => {
    const svg = renderCard({
      suit: "hearts",
      rank: "7",
      layout: "traditional",
    });
    assertWellFormed(svg);
    expect(svg).toContain(`x="${geo.frameX}"`);
    expect(placements(svg).filter((p) => p.href === "index")).toHaveLength(2);
  });

  test("turns the lower half of the pattern upside down", () => {
    const svg = renderCard({
      suit: "hearts",
      rank: "6",
      layout: "traditional",
    });
    const pips = middleColumnPips(svg);
    const rotated = pips.filter((p) => p.transform.includes("rotate(180)"));
    // Two of the six pips are below the middle line; the middle row is on it.
    expect(rotated).toHaveLength(2);
    for (const pip of rotated) {
      expect(pipCenter(svg, pip).y).toBeGreaterThan(geo.height / 2);
    }
    for (const pip of pips.filter(
      (p) => !p.transform.includes("rotate(180)"),
    )) {
      // The middle row sits on the center line, up to output rounding.
      expect(pipCenter(svg, pip).y).toBeLessThan(geo.height / 2 + 0.001);
    }
  });

  test("mirrors the pattern about the card center", () => {
    const points = pipCenters("spades", "8");
    for (const point of points) {
      const mirrored = points.some(
        (other) =>
          Math.abs(other.x - (geo.width - point.x)) < 0.01 &&
          Math.abs(other.y - (geo.height - point.y)) < 0.01,
      );
      expect(mirrored).toBe(true);
    }
  });

  test("keeps every pip inside the frame", () => {
    for (const suit of SUIT_ORDER) {
      for (const rank of ["2", "7", "9", "10"] as const) {
        const svg = renderCard({ suit, rank, layout: "traditional" });
        const glyph = GLYPHS[suit];
        const pips = middleColumnPips(svg);
        for (const pip of pips) {
          const scale = scaleOf(pip.transform);
          const center = pipCenter(svg, pip);
          const halfWidth = (glyph.width * scale) / 2;
          const halfHeight = (glyph.height * scale) / 2;
          expect(center.x - halfWidth).toBeGreaterThan(geo.frameLeft);
          expect(center.x + halfWidth).toBeLessThan(geo.frameRight);
          expect(center.y - halfHeight).toBeGreaterThan(geo.frameTop);
          expect(center.y + halfHeight).toBeLessThan(geo.frameBottom);
        }
      }
    }
  });

  test("uses one shared pip glyph for the whole pattern", () => {
    const svg = renderCard({
      suit: "clubs",
      rank: "10",
      layout: "traditional",
    });
    const hrefs = new Set(traditionalPips("clubs", "10").map((p) => p.href));
    expect([...hrefs]).toEqual(["pip"]);
    expect(countElements(svg, "path")).toBe(2);
  });

  test("is the default layout", () => {
    expect(DEFAULT_LAYOUT).toBe("traditional");
    expect(renderCard({ suit: "hearts", rank: "9" })).toBe(
      renderCard({ suit: "hearts", rank: "9", layout: "traditional" }),
    );
    expect(renderCard({ suit: "hearts", rank: "9" })).not.toBe(
      renderCard({ suit: "hearts", rank: "9", layout: "standard" }),
    );
  });

  test("scales to the poker size", () => {
    const svg = renderCard({
      suit: "diamonds",
      rank: "10",
      layout: "traditional",
      size: DECKS.poker.size,
    });
    assertWellFormed(svg);
    expect(svg).toContain('width="63mm"');
    expect(middleColumnPips(svg)).toHaveLength(10);
  });
});

describe("font selection", () => {
  test("defaults to the default font", () => {
    expect(renderCard({ suit: "diamonds", rank: "A" })).toBe(
      renderCard({ suit: "diamonds", rank: "A", font: DEFAULT_FONT }),
    );
  });

  test("swaps the glyph paths for another font", () => {
    const free = renderCard({ suit: "diamonds", rank: "A" });
    const noto = renderCard({ suit: "diamonds", rank: "A", font: "Noto Sans" });
    expect(noto).not.toBe(free);
    expect(noto).toContain(`d="${FONT_SETS["Noto Sans"].diamonds.d}"`);
    expect(noto).not.toContain(`d="${FONT_SETS[DEFAULT_FONT].diamonds.d}"`);
    expect(free).toContain(`d="${FONT_SETS[DEFAULT_FONT].diamonds.d}"`);
  });

  test("keeps the geometry identical across fonts", () => {
    for (const font of FONT_NAMES) {
      const svg = renderCard({
        suit: "clubs",
        rank: "9",
        layout: "traditional",
        font,
      });
      assertWellFormed(svg);
      expect(svg).toContain(`viewBox="0 0 ${geo.width} ${geo.height}"`);
      expect(middleColumnPips(svg)).toHaveLength(9);
      expect(placements(svg).filter((p) => p.href === "index")).toHaveLength(2);
    }
  });

  test("scales each font's glyphs to the same visual size", () => {
    // Every font is scaled to the layout's fixed heights, so the rendered pip
    // height matches across fonts even though the source paths differ.
    const renderedHeights = FONT_NAMES.map((font) => {
      const svg = renderCard({
        suit: "hearts",
        rank: "A",
        layout: "standard",
        font,
      });
      const [pip] = middleColumnPips(svg);
      return scaleOf(pip!.transform) * FONT_SETS[font].hearts.height;
    });
    for (const height of renderedHeights) {
      expect(height).toBeCloseTo(geo.centerPipHeight, 1);
    }
  });

  test("works with every layout", () => {
    for (const layout of CARD_LAYOUTS) {
      const svg = renderCard({
        suit: "spades",
        rank: "7",
        layout,
        font: "Noto Sans",
      });
      assertWellFormed(svg);
      expect(svg).toContain(`d="${FONT_SETS["Noto Sans"].spades.d}"`);
    }
  });

  test("works with the outlined style", () => {
    const svg = renderCard({
      suit: "hearts",
      rank: "Q",
      style: "outlined",
      font: "Noto Sans",
    });
    expect(svg).toContain(`d="${FONT_SETS["Noto Sans"].heartsOutlined.d}"`);
  });
});

describe("index block", () => {
  test("rank and suit symbol are the same height", () => {
    const svg = renderCard({ suit: "diamonds", rank: "A" });
    const defs = glyphDefs(svg);
    const group = svg.slice(svg.indexOf('id="index"'), svg.indexOf("</g>"));
    const inside = placements(group);
    expect(inside).toHaveLength(2);
    const height = (p: Placement): number =>
      defs.get(p.href)!.height * scaleOf(p.transform);
    expect(height(inside[0]!)).toBeCloseTo(height(inside[1]!), 1);
  });

  test("index uses are placed in columns 1 and 3", () => {
    const svg = renderCard({ suit: "diamonds", rank: "A" });
    const xs = placements(svg)
      .filter((p) => p.href === "index")
      .map((p) => translateOf(p.transform).x);
    expect(xs[0]).toBeLessThan(geo.width / 2);
    expect(xs[1]).toBeGreaterThan(geo.width / 2);
  });
});

describe("one suit height", () => {
  /**
   * Rendered height of every suit reference on a card: the symbol of the index
   * block, the corner pips and the pips of the pattern all come out as `#pip`.
   */
  function suitHeights(svg: string, glyph: Glyph): number[] {
    return placements(svg)
      .filter((p) => p.href === "pip")
      .map((p) => glyph.height * scaleOf(p.transform));
  }

  test("one suit is one size everywhere on the card", () => {
    for (const font of FONT_NAMES) {
      for (const suit of SUIT_ORDER) {
        const glyph = FONT_SETS[font][suit];
        // The nine pips of the pattern plus the symbol of the index block.
        const svg = renderCard({
          suit,
          rank: "9",
          layout: "traditional",
          font,
        });
        const heights = suitHeights(svg, glyph);
        expect(heights).toHaveLength(10);
        for (const height of heights) {
          expect(height).toBeCloseTo(geo.indexSuitHeight, 1);
        }
      }
    }
  });

  test("the four colors differ in width but not in height", () => {
    for (const font of FONT_NAMES) {
      const glyphs = FONT_SETS[font];
      const heights = SUIT_ORDER.map((suit) => glyphs[suit].height);
      const widths = SUIT_ORDER.map((suit) => glyphs[suit].width);
      // Source boxes are not identical, so the renderer has to equalize them.
      expect(new Set(heights).size).toBeGreaterThan(1);
      expect(new Set(widths).size).toBeGreaterThan(1);
      // One height per card, whatever the color: the drawn size is the layout
      // height, not the source box.
      const drawn = SUIT_ORDER.map((suit) => {
        const svg = renderCard({ suit, rank: "2", font });
        return suitHeights(svg, glyphs[suit])[0]!;
      });
      for (const height of drawn) {
        expect(height).toBeCloseTo(drawn[0]!, 1);
      }
    }
  });

  test("is the same on a bridge and a poker card", () => {
    for (const size of [DEFAULT_CARD_SIZE, DECKS.poker.size]) {
      const svg = renderCard({ suit: "spades", rank: "9", size });
      const heights = suitHeights(svg, GLYPHS.spades);
      for (const height of heights) {
        expect(height).toBeCloseTo(7 * 10, 1);
      }
    }
  });
});

describe("pretty printing", () => {
  test("is on by default", () => {
    expect(
      renderCard({ suit: "diamonds", rank: "A" }).split("\n").length,
    ).toBeGreaterThan(5);
  });

  test("collapses to a single line when disabled", () => {
    const svg = renderCard({ suit: "diamonds", rank: "A", pretty: false });
    expect(svg.trim().split("\n")).toHaveLength(1);
    assertWellFormed(svg);
  });

  test("produces the same elements either way", () => {
    const pretty = renderCard({ suit: "hearts", rank: "A", pretty: true });
    const compact = renderCard({ suit: "hearts", rank: "A", pretty: false });
    expect(pretty.replace(/\s+/g, "")).toBe(compact.replace(/\s+/g, ""));
  });
});

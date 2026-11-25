/**
 * Dev-only generator for `src/glyphs.ts`.
 *
 * Vectorizes the Unicode suit symbols and the ace rank glyph into raw path data
 * so the generator never depends on fonts at runtime. Requires `inkscape` and
 * fontconfig on the machine that regenerates the glyphs (not on the machine
 * that only renders cards).
 *
 * Usage: bun tools/extract-glyphs.ts [--font FreeSans] [--out src/glyphs.ts]
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { format } from "../src/svg.ts";
import {
  RANK_GLYPH_ID,
  RANKS,
  SUIT_ORDER,
  SUIT_SYMBOL,
  type SuitStyle,
} from "../src/suits.ts";

const GLYPH_FONT_SIZE = 1000;
const CANVAS_SIZE = 2000;

interface GlyphEntry {
  readonly id: string;
  readonly character: string;
  /** Ranks are drawn bold so the index reads clearly at card size. */
  readonly bold: boolean;
}

function glyphEntries(): GlyphEntry[] {
  const styles: readonly SuitStyle[] = ["solid", "outlined"];
  const entries: GlyphEntry[] = [];
  for (const style of styles) {
    for (const suit of SUIT_ORDER) {
      entries.push({
        id: style === "solid" ? suit : `${suit}Outlined`,
        character: SUIT_SYMBOL[suit][style],
        bold: false,
      });
    }
  }
  for (const rank of RANKS) {
    entries.push({ id: RANK_GLYPH_ID[rank], character: rank, bold: true });
  }
  return entries;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function templateSvg(character: string, font: string, bold: boolean): string {
  const baseline = CANVAS_SIZE / 2;
  const weight = bold ? ' font-weight="bold"' : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">`,
    `<text id="glyph" x="${CANVAS_SIZE / 2}" y="${baseline}" font-family="${escapeXml(font)}"${weight} font-size="${GLYPH_FONT_SIZE}">${escapeXml(character)}</text>`,
    "</svg>",
  ].join("");
}

interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Runs inkscape and returns the vectorized path plus its bounding box. */
async function vectorize(
  entry: GlyphEntry,
  font: string,
  workDir: string,
): Promise<{ d: string; bold: boolean } & BoundingBox> {
  const source = `${workDir}/glyph.svg`;
  const output = `${workDir}/glyph-out.svg`;
  await Bun.write(source, templateSvg(entry.character, font, entry.bold));

  const exportRun = Bun.spawnSync({
    cmd: [
      "inkscape",
      source,
      "--export-plain-svg",
      "--export-text-to-path",
      `--export-filename=${output}`,
    ],
    stderr: "pipe",
  });
  if (exportRun.exitCode !== 0) {
    throw new Error(
      `inkscape failed for "${entry.character}": ${exportRun.stderr.toString().trim()}`,
    );
  }

  const exported = await Bun.file(output).text();
  const pathData = /<path[^>]*\sd="([^"]+)"/.exec(exported)?.[1];
  if (!pathData) {
    throw new Error(`inkscape produced no path for "${entry.character}"`);
  }

  const queryRun = Bun.spawnSync({
    cmd: ["inkscape", output, "--query-all"],
    stderr: "pipe",
  });
  if (queryRun.exitCode !== 0) {
    throw new Error(
      `inkscape --query-all failed for "${entry.character}": ${queryRun.stderr.toString().trim()}`,
    );
  }
  const row = queryRun.stdout
    .toString()
    .split("\n")
    .find((line) => line.startsWith("glyph,"));
  const parts = row?.split(",") ?? [];
  if (parts.length < 5) {
    throw new Error(
      `inkscape --query-all returned no bbox for "${entry.character}"`,
    );
  }
  const [x, y, width, height] = parts.slice(1, 5).map(Number);
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `inkscape returned an invalid bbox for "${entry.character}"`,
    );
  }

  return {
    d: pathData.replace(/\s+/g, " ").trim(),
    bold: entry.bold,
    x,
    y,
    width,
    height,
  };
}

function renderModule(
  glyphs: ReadonlyArray<{ id: string; d: string; bold: boolean } & BoundingBox>,
  font: string,
): string {
  const lines = [
    "/*",
    " * GENERATED FILE - do not edit by hand.",
    ` * Regenerate with: bun tools/extract-glyphs.ts --font ${font}`,
    " *",
    " * Path data is vectorized from a system font at a nominal font size of",
    ` * ${GLYPH_FONT_SIZE} units. x/y/width/height describe the glyph bounding box in`,
    " * the same coordinate space, so callers can scale and center without parsing.",
    " * bold records whether the source glyph was vectorized from a bold weight.",
    " */",
    "",
    "export interface Glyph {",
    "    /** Path data in the source font coordinate space. */",
    "    readonly d: string;",
    "    /** Bounding box of the path data. */",
    "    readonly x: number;",
    "    readonly y: number;",
    "    readonly width: number;",
    "    readonly height: number;",
    "    /** True when the glyph was vectorized from a bold font weight. */",
    "    readonly bold: boolean;",
    "}",
    "",
    "export const GLYPHS = {",
  ];

  for (const glyph of glyphs) {
    lines.push(`    ${glyph.id}: {`);
    lines.push(`        d: ${JSON.stringify(glyph.d)},`);
    lines.push(`        x: ${format(glyph.x)},`);
    lines.push(`        y: ${format(glyph.y)},`);
    lines.push(`        width: ${format(glyph.width)},`);
    lines.push(`        height: ${format(glyph.height)},`);
    lines.push(`        bold: ${glyph.bold ? "true" : "false"},`);
    lines.push("    },");
  }

  lines.push("} as const satisfies Record<string, Glyph>;");
  lines.push("");
  lines.push("export type GlyphId = keyof typeof GLYPHS;");
  lines.push("");
  lines.push("/** Looks up a glyph by an untrusted identifier. */");
  lines.push("export function glyphById(id: string): Glyph | undefined {");
  lines.push("    return (GLYPHS as Record<string, Glyph>)[id];");
  lines.push("}", "");
  return lines.join("\n");
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index >= 0) {
    return args[index + 1];
  }
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

const args = process.argv.slice(2);
const font = flagValue(args, "--font") ?? "FreeSans";
const outPath = flagValue(args, "--out") ?? "src/glyphs.ts";

const workDir = await mkdtemp(join(tmpdir(), "cards-svg-glyphs-"));
const glyphs: Array<{ id: string; d: string; bold: boolean } & BoundingBox> =
  [];
for (const entry of glyphEntries()) {
  const glyph = await vectorize(entry, font, workDir);
  glyphs.push({ id: entry.id, ...glyph });
  const codePoint = entry.character.codePointAt(0)?.toString(16).toUpperCase();
  console.log(
    `${entry.id.padEnd(16)} U+${codePoint}  ` +
      `${format(glyph.width)} x ${format(glyph.height)}` +
      `${entry.bold ? "  (bold)" : ""}`,
  );
}

await Bun.write(outPath, renderModule(glyphs, font));
// Keep the generated file formatter-clean so regenerating never dirties `bun fmt --check`.
Bun.spawnSync({ cmd: [process.execPath, "fmt", outPath], stderr: "inherit" });
console.log(`wrote ${outPath} (${glyphs.length} glyphs, font: ${font})`);

await rm(workDir, { recursive: true, force: true });

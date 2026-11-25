/**
 * Minimal SVG document model: build a tree of nodes, serialize it to text.
 * Kept separate from the card geometry so both stay small and testable.
 */

/** An element plus optional child elements. */
export interface Node {
  readonly tag: string;
  readonly attributes?: Readonly<Record<string, string | number | undefined>>;
  readonly children?: readonly Node[];
}

/** Drops undefined attributes so callers can pass optional values inline. */
function definedAttributes(
  attributes: Node["attributes"],
): ReadonlyArray<[string, string]> {
  if (!attributes) {
    return [];
  }
  return Object.entries(attributes)
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(([key, value]) => [key, String(value)]);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attributesText(entries: ReadonlyArray<[string, string]>): string {
  return entries
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");
}

/** Rounds to `decimals` places, dropping trailing zeros. */
export function round(value: number, decimals = 3): number {
  return Number(value.toFixed(decimals));
}

/** Formats a number for output: 3 decimals by default, no trailing zeros. */
export function format(value: number, decimals = 3): string {
  return round(value, decimals).toString();
}

/** Serializes a node tree. `pretty` adds newlines and two-space indentation. */
export function serialize(node: Node, pretty: boolean, depth = 0): string {
  const pad = pretty ? "  ".repeat(depth) : "";
  const attributes = attributesText(definedAttributes(node.attributes));
  const open = `<${node.tag}${attributes}`;
  const children = node.children ?? [];
  if (children.length === 0) {
    return `${pad}${open}/>`;
  }
  if (!pretty) {
    const body = children.map((child) => serialize(child, false)).join("");
    return `${open}>${body}</${node.tag}>`;
  }
  const body = children
    .map((child) => serialize(child, true, depth + 1))
    .join("\n");
  return `${pad}${open}>\n${body}\n${pad}</${node.tag}>`;
}

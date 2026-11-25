import { describe, expect, test } from "bun:test";
import { format, serialize, type Node } from "./svg.ts";

describe("format", () => {
  test("drops trailing zeros", () => {
    expect(format(1.5)).toBe("1.5");
    expect(format(2)).toBe("2");
    expect(format(0.125)).toBe("0.125");
  });

  test("rounds to three decimals", () => {
    expect(format(1.0005)).toBe("1");
    expect(format(1 / 3)).toBe("0.333");
  });

  test("keeps negative values", () => {
    expect(format(-4.25)).toBe("-4.25");
  });
});

describe("serialize", () => {
  const tree: Node = {
    tag: "svg",
    attributes: { xmlns: "http://www.w3.org/2000/svg" },
    children: [
      { tag: "rect", attributes: { width: 10, height: 20 } },
      {
        tag: "g",
        attributes: { fill: "red" },
        children: [{ tag: "use", attributes: { href: "#a" } }],
      },
    ],
  };

  test("self-closes elements without children", () => {
    expect(serialize(tree, false)).toContain('<rect width="10" height="20"/>');
  });

  test("skips undefined attributes", () => {
    const node: Node = { tag: "rect", attributes: { x: 1, y: undefined } };
    expect(serialize(node, false)).toBe('<rect x="1"/>');
  });

  test("escapes attribute values", () => {
    const node: Node = { tag: "a", attributes: { v: `<&">` } };
    expect(serialize(node, false)).toBe('<a v="&lt;&amp;&quot;&gt;"/>');
  });

  test("pretty output has indentation and newlines", () => {
    const pretty = serialize(tree, true);
    expect(pretty.split("\n").length).toBe(6);
    expect(pretty).toContain('\n  <rect width="10" height="20"/>');
  });

  test("compact and pretty carry the same content", () => {
    expect(serialize(tree, true).replace(/\s+/g, "")).toBe(
      serialize(tree, false).replace(/\s+/g, ""),
    );
  });
});

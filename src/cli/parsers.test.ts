import { describe, expect, test } from "bun:test";
import {
  deckParser,
  fontParser,
  hexColorParser,
  layoutParser,
  pathParser,
  rankParser,
  styleParser,
  suitParser,
} from "./parsers.ts";

describe("choice parsers", () => {
  test("fold case and whitespace", () => {
    expect(rankParser("a")).toBe("A");
    expect(styleParser("OUTLINED")).toBe("outlined");
    expect(layoutParser("Traditional")).toBe("traditional");
    expect(deckParser("BRIDGE")).toBe("bridge");
    expect(fontParser("  noto   SANS ")).toBe("Noto Sans");
  });

  test("return the canonical spelling, not the input", () => {
    expect(rankParser("k")).toBe("K");
    expect(fontParser("NOTO SANS")).toBe("Noto Sans");
  });

  test("reject a value that is not on the list", () => {
    expect(() => rankParser("1")).toThrow();
    expect(() => styleParser("hollow")).toThrow();
    expect(() => layoutParser("giant")).toThrow();
    expect(() => deckParser("euchre")).toThrow();
    expect(() => fontParser("Comic Sans")).toThrow();
  });

  test("suggest the closest value for a typo", () => {
    expect(() => fontParser("noto sanss")).toThrow(/did you mean "Noto Sans"/);
    expect(() => deckParser("pokr")).toThrow(/did you mean "poker"/);
  });

  test("list every valid value when the input is unrelated", () => {
    expect(() => styleParser("weird")).toThrow(/solid\|outlined/);
  });
});

describe("suit parser", () => {
  test("accepts singular and plural, in any case", () => {
    expect(suitParser("diamonds")).toBe("diamonds");
    expect(suitParser("diamond")).toBe("diamonds");
    expect(suitParser("DIAMOND")).toBe("diamonds");
    expect(suitParser(" Club ")).toBe("clubs");
  });

  test("rejects a non-suit and suggests a correction", () => {
    expect(() => suitParser("diamonds2")).toThrow();
    expect(() => suitParser("diamnds")).toThrow(/did you mean/);
  });
});

describe("value parsers", () => {
  test("hex color accepts and normalizes", () => {
    expect(hexColorParser("#C8102E")).toBe("#C8102E");
    expect(hexColorParser("c8102e")).toBe("#C8102E");
    expect(() => hexColorParser("red")).toThrow(/hex color/);
    expect(() => hexColorParser("#GGGGGG")).toThrow(/hex color/);
  });

  test("path rejects an empty value", () => {
    expect(pathParser("a/b.svg")).toBe("a/b.svg");
    expect(() => pathParser("")).toThrow(/file path/);
    expect(() => pathParser("   ")).toThrow(/file path/);
  });
});

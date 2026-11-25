import type { InputParser } from "@stricli/core";

/** Accepts `#RRGGBB` or `RRGGBB` and normalizes to the `#`-prefixed form. */
export const hexColorParser: InputParser<string> = (input: string): string => {
  const value = input.trim();
  const normalized = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`expected a hex color like #C8102E, got "${input}"`);
  }
  return normalized.toUpperCase();
};

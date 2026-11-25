import { buildApplication, buildRouteMap, run } from "@stricli/core";
import type { CardContext } from "./context.ts";
import { deckCommand } from "./deck.ts";
import { generateCommand } from "./generate.ts";

const routeMap = buildRouteMap<"generate" | "deck", CardContext>({
  routes: { generate: generateCommand, deck: deckCommand },
  defaultCommand: "generate",
  docs: {
    brief: "Generate bridge playing cards as standalone SVG documents",
    fullDescription:
      "Cards are built from three columns (20% / 60% / 20%). Generate one card " +
      "with `cards-svg generate`, or a whole deck with `cards-svg deck bridge`. " +
      "Run `--help` on either command for the full list of options.",
  },
});

export const application = buildApplication<CardContext>(routeMap, {
  name: "cards-svg",
  scanner: { caseStyle: "allow-kebab-for-camel" },
});

/** Runs the CLI with the given inputs, e.g. `["generate", "diamonds", "A"]`. */
export async function main(
  inputs: readonly string[] = process.argv.slice(2),
  context?: CardContext,
): Promise<void> {
  await run(application, [...inputs], context ?? defaultContext());
}

function defaultContext(): CardContext {
  // Passing the real `process` lets Stricli report failures via `process.exitCode`.
  return { process };
}

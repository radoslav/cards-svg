import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "@stricli/core";
import { application } from "./main.ts";
import { run } from "@stricli/core";

interface Capture {
  readonly context: CommandContext;
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly exitCode: () => number | string | null | undefined;
}

function capture(): Capture {
  let out = "";
  let err = "";
  const processStreams = {
    stdout: { write: (value: string) => (out += value) },
    stderr: { write: (value: string) => (err += value) },
    exitCode: undefined as number | string | null | undefined,
  };
  return {
    context: { process: processStreams },
    stdout: () => out,
    stderr: () => err,
    exitCode: () => processStreams.exitCode,
  };
}

async function runCli(inputs: readonly string[]): Promise<Capture> {
  const captureStreams = capture();
  await run(application, [...inputs], captureStreams.context);
  return captureStreams;
}

describe("generate command", () => {
  test("renders the ace of diamonds to stdout by default", async () => {
    const result = await runCli(["diamonds", "A"]);
    expect(result.stdout()).toContain("<svg");
    expect(result.stdout()).toContain('width="57mm"');
    expect(result.exitCode()).toBe(0);
  });

  test("accepts the route name explicitly", async () => {
    const result = await runCli(["generate", "hearts", "A"]);
    expect(result.stdout()).toContain("<svg");
    expect(result.stdout()).toContain("#C8102E");
  });

  test("accepts singular suit names", async () => {
    const result = await runCli(["spade", "A"]);
    expect(result.stdout()).toContain("#1A1A1A");
  });

  test("falls back to the ace of diamonds with no arguments", async () => {
    const result = await runCli([]);
    expect(result.stdout()).toContain("<svg");
    expect(result.exitCode()).toBe(0);
  });

  test("honours --no-pretty", async () => {
    const result = await runCli(["diamonds", "A", "--no-pretty"]);
    expect(result.stdout().trim().split("\n")).toHaveLength(1);
  });

  test("honours --style outlined", async () => {
    const solid = await runCli(["diamonds", "A"]);
    const outlined = await runCli(["diamonds", "A", "--style", "outlined"]);
    expect(outlined.stdout()).not.toBe(solid.stdout());
  });

  test("honours --color with and without the hash", async () => {
    const withHash = await runCli(["diamonds", "A", "--color", "#00FF00"]);
    const withoutHash = await runCli(["diamonds", "A", "--color", "00ff00"]);
    expect(withHash.stdout()).toContain("#00FF00");
    expect(withoutHash.stdout()).toContain("#00FF00");
    expect(withoutHash.stdout()).toBe(withHash.stdout());
  });

  test("honours --layout jumbo", async () => {
    const standard = await runCli(["diamonds", "A"]);
    const jumbo = await runCli(["diamonds", "A", "--layout", "jumbo"]);
    expect(jumbo.stdout()).toContain("<svg");
    expect(jumbo.stdout()).not.toBe(standard.stdout());
    // One big pip only: the middle column references one shared glyph.
    const body = jumbo.stdout().slice(jumbo.stdout().indexOf("</defs>"));
    const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
    expect((group.match(/<use/g) ?? []).length).toBe(1);
  });

  test("honours --layout traditional", async () => {
    const result = await runCli(["hearts", "9", "--layout", "traditional"]);
    expect(result.stdout()).toContain("<svg");
    // Nine pips in the middle column, all pointing at the shared glyph.
    const body = result.stdout().slice(result.stdout().indexOf("</defs>"));
    const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
    expect((group.match(/<use/g) ?? []).length).toBe(9);
  });

  test("traditional falls back to five pips for the ace", async () => {
    const traditional = await runCli([
      "hearts",
      "A",
      "--layout",
      "traditional",
    ]);
    const standard = await runCli(["hearts", "A"]);
    expect(traditional.stdout()).toBe(standard.stdout());
  });

  test("rejects an unknown layout", async () => {
    const result = await runCli(["diamonds", "A", "--layout", "giant"]);
    expect(result.exitCode()).toBe(-4);
  });

  test("writes a file with --out", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cards-svg-test-"));
    try {
      const target = join(dir, "diamond-A.svg");
      const result = await runCli(["diamonds", "A", "--out", target]);
      expect(result.stdout()).toContain(target);
      const written = await Bun.file(target).text();
      expect(written).toContain("<svg");
      expect(written).toContain("</svg>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("rejects an unknown rank", async () => {
    const result = await runCli(["diamonds", "1"]);
    expect(result.stdout()).toBe("");
    expect(result.stderr()).toContain("rank");
    expect(result.exitCode()).toBe(-4);
  });

  test("rejects an unknown suit", async () => {
    const result = await runCli(["diamonds", "A", "--style", "sketchy"]);
    expect(result.exitCode()).toBe(-4);
  });

  test("rejects a malformed color", async () => {
    const result = await runCli(["diamonds", "A", "--color", "red"]);
    expect(result.stderr()).toContain("hex color");
    expect(result.exitCode()).toBe(-4);
  });

  test("reports a failure when the output path is unwritable", async () => {
    const result = await runCli([
      "diamonds",
      "A",
      "--out",
      "/proc/definitely-not-writable/card.svg",
    ]);
    expect(result.exitCode()).not.toBe(0);
  });
});

describe("generate --deck", () => {
  test("adopts the poker size and jumbo layout", async () => {
    const result = await runCli(["spades", "A", "--deck", "poker"]);
    expect(result.stdout()).toContain('width="63mm"');
    expect(result.stdout()).toContain('height="88mm"');
    const body = result.stdout().slice(result.stdout().indexOf("</defs>"));
    const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
    expect((group.match(/<use/g) ?? []).length).toBe(1);
  });

  test("adopts the bridge size", async () => {
    const result = await runCli(["spades", "A", "--deck", "bridge"]);
    expect(result.stdout()).toContain('height="89mm"');
  });

  test("an explicit --layout still wins over the preset", async () => {
    const result = await runCli([
      "spades",
      "A",
      "--deck",
      "poker",
      "--layout",
      "standard",
    ]);
    const body = result.stdout().slice(result.stdout().indexOf("</defs>"));
    const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
    expect((group.match(/<use/g) ?? []).length).toBe(5);
  });

  test("rejects an unknown deck", async () => {
    const result = await runCli(["spades", "A", "--deck", "euchre"]);
    expect(result.exitCode()).toBe(-4);
  });
});

describe("deck command", () => {
  test("writes 52 bridge cards to <out-dir>/bridge/", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cards-svg-bridge-"));
    try {
      const result = await runCli(["deck", "bridge", "--out-dir", dir]);
      expect(result.stdout()).toContain(`${dir}/bridge/`);
      expect(result.exitCode()).toBe(0);
      const ace = await Bun.file(join(dir, "bridge", "spades-A.svg")).text();
      expect(ace).toContain('height="89mm"');
      const ten = await Bun.file(join(dir, "bridge", "hearts-10.svg")).text();
      expect(ten).toContain("<svg");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("writes 52 poker cards in jumbo layout", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cards-svg-poker-"));
    try {
      const result = await runCli(["deck", "poker", "--out-dir", dir]);
      expect(result.stdout()).toContain(`${dir}/poker/`);
      const card = await Bun.file(join(dir, "poker", "clubs-K.svg")).text();
      expect(card).toContain('width="63mm"');
      const body = card.slice(card.indexOf("</defs>"));
      const group = body.slice(body.indexOf("<g "), body.indexOf("</g>"));
      expect((group.match(/<use/g) ?? []).length).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("requires a deck name", async () => {
    const result = await runCli(["deck"]);
    expect(result.exitCode()).not.toBe(0);
  });

  test("rejects an unknown deck", async () => {
    const result = await runCli(["deck", "euchre"]);
    expect(result.exitCode()).toBe(-4);
  });
});

describe("help", () => {
  test("prints usage for the application", async () => {
    const result = await runCli(["--help"]);
    expect(result.stdout()).toContain("USAGE");
    expect(result.stdout()).toContain("generate");
  });

  test("documents the flags", async () => {
    const result = await runCli(["generate", "--help"]);
    expect(result.stdout()).toContain("--style");
    expect(result.stdout()).toContain("--out");
    expect(result.stdout()).toContain("--no-pretty");
  });
});

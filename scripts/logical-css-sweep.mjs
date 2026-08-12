#!/usr/bin/env node
/**
 * Rewrites physical Tailwind utilities to logical ones so the whole layout
 * mirrors in RTL without a single `rtl:` override.
 *
 * Two things are deliberately left alone:
 *   • `left-1/2 … -translate-x-1/2` — absolute centring, already correct in
 *     both directions, and `translate-x` does not flip.
 *   • `rounded-l/r` inside the shadcn primitives that mirror on their own.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MAP = [
  [/\bml-(\[?[\w./%-]+\]?)/g, "ms-$1"],
  [/\bmr-(\[?[\w./%-]+\]?)/g, "me-$1"],
  [/\bpl-(\[?[\w./%-]+\]?)/g, "ps-$1"],
  [/\bpr-(\[?[\w./%-]+\]?)/g, "pe-$1"],
  [/\bborder-l\b/g, "border-s"],
  [/\bborder-r\b/g, "border-e"],
  [/\bborder-l-(\[?[\w./%-]+\]?)/g, "border-s-$1"],
  [/\bborder-r-(\[?[\w./%-]+\]?)/g, "border-e-$1"],
  [/\brounded-l-(\[?[\w./%-]+\]?)/g, "rounded-s-$1"],
  [/\brounded-r-(\[?[\w./%-]+\]?)/g, "rounded-e-$1"],
  [/\btext-left\b/g, "text-start"],
  [/\btext-right\b/g, "text-end"],
  // Positional offsets, but never the centring pair.
  [/\bleft-(?!1\/2)(\[?[\w./%-]+\]?)/g, "start-$1"],
  [/\bright-(?!1\/2)(\[?[\w./%-]+\]?)/g, "end-$1"],
];

const files = execSync(
  "git ls-files 'src/presentation/**/*.tsx' 'src/app/**/*.tsx'",
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

let changed = 0;
let replacements = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;

  for (const [pattern, replacement] of MAP) {
    after = after.replace(pattern, (...args) => {
      replacements += 1;
      return replacement.replace("$1", args[1] ?? "");
    });
  }

  if (after !== before) {
    writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`${replacements} utilities rewritten across ${changed} files.`);

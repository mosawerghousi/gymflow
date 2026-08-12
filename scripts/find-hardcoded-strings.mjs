#!/usr/bin/env node
/**
 * Static scan for user-visible English that never reached the catalogue.
 *
 * `scripts/i18n-sweep.ts` is the runtime check: it drives a browser and reads
 * what actually rendered. It is the more truthful of the two, but it only sees
 * screens it visits, in the states it manages to reach — an error toast, a
 * disabled-button tooltip or an empty state behind a filter can hide from it
 * forever. This one reads the source instead, so coverage does not depend on
 * being able to reproduce a state.
 *
 * It is deliberately blunt. It looks at JSX text and at the props that end up
 * in front of a user, and it flags anything that reads like a sentence. False
 * positives are cheap to silence with `// i18n-ignore`; a missed string ships
 * English to a Dari user.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN = ["src/app", "src/presentation"];

/** Files whose strings are never rendered to a gym user. */
const SKIP_FILE = [
  /\/store\/api\//, //          RTK Query cache tags
  /\.test\.tsx?$/,
  /\/lib\/format\.ts$/, //      the formatters themselves
  // The style guide is a developer reference for the design system. Its
  // labels name tokens and components ("Small", "Default", "Destructive"),
  // which are English design vocabulary, not product copy. Documented in
  // TRANSLATIONS.md.
  /\/components\/styleguide\//,
  /\/styleguide\/page\.tsx$/,
];

/** Props that reach the screen. Anything else is treated as machinery. */
const VISIBLE_PROPS = [
  "title",
  "label",
  "description",
  "placeholder",
  "aria-label",
  "alt",
  "heading",
  "hint",
  "emptyLabel",
  "submitLabel",
  "confirmLabel",
  "cancelLabel",
  "name",
];

const looksLikeProse = (value) =>
  // Two or more words, or one capitalised word of real length. Rules this out:
  // class names, ids, keys, url fragments, format tokens, single symbols.
  /^[A-Z][a-z]/.test(value) &&
  value.length > 2 &&
  !/^[a-z-]+$/.test(value) &&
  !/[_/\\]/.test(value) &&
  !/^\w+\(/.test(value);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(full)) yield full;
  }
}

const findings = [];

for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (SKIP_FILE.some((pattern) => pattern.test(rel))) continue;

    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((line, index) => {
      if (line.includes("i18n-ignore")) return;
      // Comments describe the code, not the user's screen.
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      if (/^\s*\*/.test(line)) return;

      // 1. Text sitting directly between JSX tags: >Save changes</span>
      //    Requiring the closing "</" keeps TypeScript generics (Promise<T>)
      //    out of the results.
      for (const match of code.matchAll(/>([^<>{}\n]{3,})<\//g)) {
        const text = match[1].trim();
        if (looksLikeProse(text)) {
          findings.push({ rel, line: index + 1, text, why: "JSX text" });
        }
      }

      // 2. A visible prop given a literal: placeholder="Search members"
      for (const match of code.matchAll(
        new RegExp(`\\b(${VISIBLE_PROPS.join("|")})=["']([^"']{3,})["']`, "g"),
      )) {
        const [, prop, text] = match;
        if (looksLikeProse(text)) {
          findings.push({ rel, line: index + 1, text, why: `${prop}=` });
        }
      }

      // 3. Zod messages — they surface verbatim under the field.
      for (const match of code.matchAll(/\.(?:min|max|email|url|uuid|regex|refine)\([^)]*["']([^"']{6,})["']/g)) {
        if (looksLikeProse(match[1])) {
          findings.push({ rel, line: index + 1, text: match[1], why: "zod message" });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log("\n  No hardcoded user-visible strings.\n");
  process.exit(0);
}

const byFile = new Map();
for (const finding of findings) {
  if (!byFile.has(finding.rel)) byFile.set(finding.rel, []);
  byFile.get(finding.rel).push(finding);
}

console.log("");
for (const [rel, group] of [...byFile].sort()) {
  console.log(`  ${rel}`);
  for (const { line, text, why } of group) {
    console.log(`    ${String(line).padStart(4)}  [${why}] ${text}`);
  }
}
console.log(
  `\n  ${findings.length} hardcoded string(s) in ${byFile.size} file(s).` +
    `\n  Move each into messages/en.json, or mark the line // i18n-ignore.\n`,
);
process.exit(1);

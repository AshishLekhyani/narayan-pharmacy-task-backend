import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const IGNORE = new Set(["node_modules", "dist", ".git", "generated"]);
const PATTERNS = [
  /sk-ant-[a-zA-Z0-9_-]{20,}/,
  /npg_[a-zA-Z0-9]{10,}/,
  /ANTHROPIC_API_KEY\s*=\s*sk-/,
  /postgresql:\/\/[^:]+:[^@\/\s]+@/,
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (!entry.startsWith(".env")) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(ROOT)) {
  if (file.endsWith("verify-no-secrets.mjs")) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of PATTERNS) {
    if (pattern.test(text)) {
      violations.push({ file, pattern: pattern.toString() });
    }
  }
}

if (violations.length > 0) {
  console.error("SECRET SCAN FAILED — possible credentials in tracked source files:");
  for (const v of violations) console.error(`  ${v.file} matched ${v.pattern}`);
  process.exit(1);
}

console.log("Secret scan passed — no hardcoded API keys or database URLs found in source.");

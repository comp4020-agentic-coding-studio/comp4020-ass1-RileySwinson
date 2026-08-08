#!/usr/bin/env node
// Every .html file in the repo is a page: this copies the site's static
// files into dist/ unchanged, so add pages, link them, and this picks them
// up with no config. There's no bundler because there's nothing to bundle —
// hand-written HTML/CSS/JS is already what ships.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const SKIP = new Set([
  "node_modules",
  "dist",
  "spec",
  "scripts",
  "reflections",
  ".git",
  ".github",
  ".githooks",
]);

const SITE_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".webmanifest",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".pdf",
  ".txt",
  ".xml",
]);

function siteFiles(dir = "."): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return siteFiles(path);
    const ext = path.slice(path.lastIndexOf("."));
    return SITE_EXTENSIONS.has(ext) ? [path] : [];
  });
}

const files = siteFiles();
const pages = files.filter((f) => f.endsWith(".html"));
if (pages.length === 0) {
  console.error("build: no .html files found — nothing to ship");
  process.exit(1);
}

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
for (const file of files) {
  const dest = join("dist", file);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(file, dest);
}

console.log(`build: copied ${files.length} file(s), ${pages.length} page(s) → dist/`);

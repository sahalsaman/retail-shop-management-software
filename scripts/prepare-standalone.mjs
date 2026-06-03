#!/usr/bin/env node
// After `next build` with output:"standalone", Next.js does NOT copy the
// .next/static folder or public/ into the standalone tree (intentional, see
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
// We need them sitting next to server.js for the bundled server to serve
// static assets correctly. This script does the copy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

if (!fs.existsSync(STANDALONE)) {
  console.error(
    "ERROR: .next/standalone is missing. Make sure next.config.ts has output:\"standalone\" and `next build` succeeded.",
  );
  process.exit(1);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`(skip) ${path.relative(ROOT, src)} does not exist`);
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`  ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

console.log("Hydrating .next/standalone with static assets…");
copyDir(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"));
copyDir(path.join(ROOT, "public"), path.join(STANDALONE, "public"));
console.log("Standalone bundle ready.");

#!/usr/bin/env node
// Regenerate build/icon.ico from build/icon.png. NSIS needs a true multi-resolution
// .ico; electron-builder won't convert PNG itself for installer/uninstaller graphics.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(ROOT, "build", "icon.png");
const dest = path.join(ROOT, "build", "icon.ico");

if (!fs.existsSync(src)) {
  console.error(`Missing source: ${src}`);
  process.exit(1);
}

const buf = await pngToIco(src);
fs.writeFileSync(dest, buf);
console.log(`build/icon.ico ${buf.length} bytes`);

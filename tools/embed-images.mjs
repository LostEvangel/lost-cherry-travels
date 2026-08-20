#!/usr/bin/env node
/**
 * Post-process mdflow HTML/wxhtml: compress local images and embed as base64.
 *
 * Usage:
 *   node tools/embed-images.mjs <file.html|file.wxhtml>
 *
 * Output (same directory, does not overwrite input):
 *   foo.html    -> foo.inline.html
 *   foo.wxhtml  -> foo.inline.wxhtml
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const MAX_EDGE = 1200;
const JPEG_QUALITY = 75;
const IMG_SRC_RE = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;

function usageAndExit(code = 1) {
  console.error("用法: node tools/embed-images.mjs <file.html|file.wxhtml>");
  process.exit(code);
}

function inlineOutputPath(inputPath) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath);
  if (base.toLowerCase().endsWith(".wxhtml")) {
    const stem = base.slice(0, -".wxhtml".length);
    return path.join(dir, `${stem}.inline.wxhtml`);
  }
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  return path.join(dir, `${stem}.inline${ext || ".html"}`);
}

function shouldSkipSrc(src) {
  const s = src.trim();
  if (!s) return true;
  if (/^(https?:|data:|file:|\/\/)/i.test(s)) return true;
  return false;
}

async function fileExists(p) {
  try {
    await access(p, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function toDataUri(absImagePath) {
  const buf = await sharp(absImagePath)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function run() {
  const inputArg = process.argv[2];
  if (!inputArg || inputArg === "-h" || inputArg === "--help") {
    usageAndExit(inputArg ? 0 : 1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  if (!(await fileExists(inputPath))) {
    console.error(`找不到文件: ${inputPath}`);
    process.exit(1);
  }

  const htmlDir = path.dirname(inputPath);
  const html = await readFile(inputPath, "utf8");
  const cache = new Map();
  let embedded = 0;
  let skipped = 0;
  let missing = 0;

  const parts = [];
  let lastIndex = 0;
  const re = new RegExp(IMG_SRC_RE.source, "gi");
  let match;
  while ((match = re.exec(html)) !== null) {
    const full = match[0];
    const prefix = match[1];
    const quote = match[2];
    const src = match[3];
    const start = match.index;

    parts.push(html.slice(lastIndex, start));
    lastIndex = start + full.length;

    if (shouldSkipSrc(src)) {
      parts.push(full);
      skipped += 1;
      continue;
    }

    const decodedSrc = decodeURIComponent(src.replace(/\\/g, "/"));
    const abs = path.resolve(htmlDir, decodedSrc);

    if (!(await fileExists(abs))) {
      console.warn(`跳过（文件不存在）: ${src}`);
      parts.push(full);
      missing += 1;
      continue;
    }

    try {
      let dataUri = cache.get(abs);
      if (!dataUri) {
        dataUri = await toDataUri(abs);
        cache.set(abs, dataUri);
      }
      const rest = full.slice(prefix.length + quote.length + src.length + quote.length);
      parts.push(`${prefix}${quote}${dataUri}${quote}${rest}`);
      embedded += 1;
    } catch (err) {
      console.warn(`跳过（处理失败）: ${src} — ${err.message}`);
      parts.push(full);
      skipped += 1;
    }
  }
  parts.push(html.slice(lastIndex));

  const out = parts.join("");
  const outputPath = inlineOutputPath(inputPath);
  await writeFile(outputPath, out, "utf8");

  const inSize = Buffer.byteLength(html, "utf8");
  const outSize = Buffer.byteLength(out, "utf8");
  console.log(`输入: ${inputPath}`);
  console.log(`输出: ${outputPath}`);
  console.log(
    `内嵌 ${embedded} 张，跳过 ${skipped}，缺失 ${missing}；体积 ${(inSize / 1024).toFixed(1)} KB → ${(outSize / 1024).toFixed(1)} KB`
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain || process.argv[1]?.endsWith("embed-images.mjs")) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

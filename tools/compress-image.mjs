#!/usr/bin/env node
/**
 * 用 sharp 把图片压到指定大小以内（尽量保分辨率，优先降质量）。
 *
 * 用法:
 *   node tools/compress-image.mjs <图片路径> <目标大小>
 *
 * 目标大小示例:
 *   10M   10MB   500K   500KB   10485760
 *
 * 默认覆盖原文件；加 --out <路径> 可写到新文件。
 * 若原文件被占用（如 Cursor 正在预览），会写入旁路临时文件并提示。
 */
import { readFile, writeFile, access, stat, unlink, rename } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

function usageAndExit(code = 1) {
  console.error(`用法: node tools/compress-image.mjs <图片路径> <目标大小> [--out <输出路径>]

示例:
  node tools/compress-image.mjs trips/2026-开封郑州洛阳/assets/龙门亮灯.JPG 10M
  node tools/compress-image.mjs ./photo.JPG 2MB --out ./photo.small.JPG

目标大小支持: 10M / 10MB / 500K / 500KB / 纯字节数`);
  process.exit(code);
}

function parseSize(raw) {
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(\d+(?:\.\d+)?)(K|KB|M|MB|G|GB)$/);
  if (!m) {
    throw new Error(`无法解析目标大小: ${raw}`);
  }
  const n = Number(m[1]);
  const unit = m[2];
  const mul =
    unit === "K" || unit === "KB"
      ? 1024
      : unit === "M" || unit === "MB"
        ? 1024 * 1024
        : 1024 * 1024 * 1024;
  return Math.floor(n * mul);
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

async function fileExists(p) {
  try {
    await access(p, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    usageAndExit(args[0] ? 0 : 1);
  }

  let outPath = null;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--out") {
      outPath = args[i + 1];
      if (!outPath) {
        console.error("--out 需要路径");
        process.exit(1);
      }
      i += 1;
      continue;
    }
    positional.push(args[i]);
  }

  if (positional.length < 2) usageAndExit(1);
  return {
    inputPath: path.resolve(process.cwd(), positional[0]),
    targetBytes: parseSize(positional[1]),
    outPath: outPath ? path.resolve(process.cwd(), outPath) : null,
  };
}

async function encodeJpeg(inputBuf, { quality, maxEdge }) {
  return sharp(inputBuf)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    // 不用 mozjpeg：同样 quality 往往压得过狠，难贴近目标大小
    .jpeg({ quality, mozjpeg: false, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * 压到不超过 targetBytes，并尽量接近目标（从下方逼近）。
 * 先对 quality 二分；若 quality=100 仍超标，再逐步缩小边长。
 */
async function compressToLimit(inputBuf, targetBytes) {
  const meta = await sharp(inputBuf).metadata();
  const maxDim = Math.max(meta.width || 0, meta.height || 0) || 4000;
  let maxEdge = maxDim;
  let best = null;

  for (let dimRound = 0; dimRound < 24; dimRound += 1) {
    let lo = 40;
    let hi = 100;
    let localBest = null;

    while (lo <= hi) {
      const quality = Math.floor((lo + hi) / 2);
      const buf = await encodeJpeg(inputBuf, { quality, maxEdge });
      if (buf.length <= targetBytes) {
        localBest = { buf, quality, maxEdge, size: buf.length };
        lo = quality + 1;
      } else {
        hi = quality - 1;
      }
    }

    if (localBest) {
      if (
        !best ||
        localBest.size > best.size ||
        (localBest.size === best.size && localBest.quality > best.quality)
      ) {
        best = localBest;
      }
      if (maxEdge >= maxDim) return best;
      if (best.size >= targetBytes * 0.85) return best;
    }

    if (maxEdge <= 800) break;
    maxEdge = Math.max(800, Math.floor(maxEdge * 0.9));
  }

  if (best) return best;

  const buf = await encodeJpeg(inputBuf, { quality: 40, maxEdge: 800 });
  return { buf, quality: 40, maxEdge: 800, size: buf.length, failed: true };
}

function isLockError(err) {
  const code = err?.code;
  return (
    code === "EBUSY" ||
    code === "EPERM" ||
    code === "EACCES" ||
    code === "UNKNOWN" ||
    err?.errno === -4094
  );
}

/** 先写临时文件，再替换目标；失败时保留临时文件。 */
async function writeWithFallback(dest, buf) {
  const tmp = `${dest}.compress-tmp`;
  await writeFile(tmp, buf);

  // 直接覆盖目标（最多重试几次，应对短暂占用）
  for (let i = 0; i < 5; i += 1) {
    try {
      try {
        await unlink(dest);
      } catch (err) {
        if (err?.code !== "ENOENT") throw err;
      }
      await rename(tmp, dest);
      return { path: dest, viaTemp: false };
    } catch (err) {
      if (!isLockError(err) || i === 4) {
        // 保留 tmp，给出可读提示
        const fallback = dest.replace(/(\.[^.]+)?$/, ".compressed$1");
        try {
          await rename(tmp, fallback);
        } catch {
          // tmp 已在，用 tmp 路径提示
          console.error(`无法覆盖原文件（可能被 Cursor 预览/资源管理器占用）: ${dest}`);
          console.error(`压缩结果已保存在: ${tmp}`);
          console.error(`请关闭该图片预览后，手动替换；或加 --out 指定输出路径。`);
          throw err;
        }
        console.warn(`无法覆盖原文件（可能被占用）: ${dest}`);
        console.warn(`压缩结果已另存为: ${fallback}`);
        console.warn(`请关闭图片预览后替换原文件，或下次直接用 --out。`);
        return { path: fallback, viaTemp: true };
      }
      await sleep(200 * (i + 1));
    }
  }

  return { path: dest, viaTemp: false };
}

async function run() {
  const { inputPath, targetBytes, outPath } = parseArgs(process.argv);

  if (!(await fileExists(inputPath))) {
    console.error(`找不到文件: ${inputPath}`);
    process.exit(1);
  }
  if (!(targetBytes > 0)) {
    console.error("目标大小必须大于 0");
    process.exit(1);
  }

  const before = (await stat(inputPath)).size;
  const dest = outPath || inputPath;

  // 先整文件读入内存，避免 sharp 反复占着文件句柄
  const inputBuf = await readFile(inputPath);

  if (before <= targetBytes) {
    if (outPath) {
      await writeFile(dest, inputBuf);
    }
    console.log(`已 ≤ 目标大小，无需压缩`);
    console.log(`输入: ${inputPath} (${formatBytes(before)})`);
    console.log(`目标: ${formatBytes(targetBytes)}`);
    if (outPath) console.log(`输出: ${dest}`);
    return;
  }

  const result = await compressToLimit(inputBuf, targetBytes);
  const written = outPath
    ? (await writeFile(dest, result.buf), { path: dest, viaTemp: false })
    : await writeWithFallback(dest, result.buf);

  console.log(`输入: ${inputPath}`);
  console.log(`输出: ${written.path}`);
  console.log(
    `${formatBytes(before)} → ${formatBytes(result.buf.length)}（目标 ${formatBytes(targetBytes)}，quality=${result.quality}，maxEdge=${result.maxEdge}）`
  );

  if (result.failed || result.buf.length > targetBytes) {
    console.warn(`警告: 未能压到目标大小以内，当前 ${formatBytes(result.buf.length)}`);
    process.exitCode = 2;
  }
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
const invoked = process.argv[1] && path.resolve(process.argv[1]) === thisFile;

if (invoked || process.argv[1]?.endsWith("compress-image.mjs")) {
  run().catch((err) => {
    if (!isLockError(err)) console.error(err);
    process.exit(1);
  });
}

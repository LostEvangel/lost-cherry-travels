# 图片内嵌（mdflow 后处理）

**日期：** 2026-08-20  
**状态：** 已采用  
**方案：** mdflow 导出 + `tools/embed-images.mjs` 压缩并 base64 内嵌

## 目标

在保留 mdflow 杂志暖色排版的前提下，生成可单文件分享 / 更易粘贴的 HTML（本地图内嵌）。

## 用法

```bash
mdflow trips/.../攻略.md --theme=优雅 --primary-color=活力橘 --wxoutput
node tools/embed-images.mjs trips/.../攻略.html
node tools/embed-images.mjs trips/.../攻略.wxhtml
```

输出（不覆盖原文件）：

- `攻略.inline.html`
- `攻略.inline.wxhtml`

## 规则

- 只处理相对路径本地图（跳过 `http(s):` / `data:`）
- 最长边约 1200px，JPEG 质量约 75，再写入 `data:image/jpeg;base64,...`
- 依赖：本仓库 `sharp`（`npm install` 一次即可）

## 不做

- 不替换 mdflow
- 不把大图原样 base64（必须先压缩）

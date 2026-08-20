# lost-cherry-travels

个人旅行笔记合集：出发前计划、分享向回顾攻略、配图都按行程归档。

## 行程索引

| 行程 | 状态 | 一句话 |
| --- | --- | --- |
| [2026 · 烟台威海五日](./trips/2026-烟台威海/) | 定稿 | 海岸线 + 转场 + 荣成自驾 |
| [2026 · 开封郑州洛阳](./trips/2026-开封郑州洛阳/) | 定稿 | 开封清明上河园 + 郑州 + 洛阳龙门，顺路胖东来 |

## 目录约定

```text
trips/年份-目的地/
  README.md   # 简介、天数、标签
  攻略.md     # 定稿正文（给人看的主文件）
  大纲.md     # 写作骨架
  计划.md     # 出发前计划（可选）
  assets/     # 配图
```

新建一篇时，可复制 `_templates/分享向回顾攻略.md` 到对应行程目录，再改成 `大纲.md` / 扩写成 `攻略.md`。

## 导出 HTML（mdflow）

已全局安装现成工具 [@rongyan/mdflow-cli](https://www.npmjs.com/package/@rongyan/mdflow-cli)。杂志暖色示例：

```bash
mdflow trips/2026-开封郑州洛阳/攻略.md --theme=优雅 --primary-color=活力橘 --wxoutput
```

同目录生成 `攻略.html`（预览/分享）和 `攻略.wxhtml`（公众号粘贴用）。

相对路径配图在本地打开 HTML 时正常；**单文件分享或减少对 `assets/` 依赖**时，再做一步内嵌。

## 图片内嵌（可复用）

首次在本仓库执行一次依赖安装：

```bash
npm install
```

对 mdflow 产物压缩并 base64 内嵌（不覆盖原文件）：

```bash
node tools/embed-images.mjs trips/2026-开封郑州洛阳/攻略.html
node tools/embed-images.mjs trips/2026-开封郑州洛阳/攻略.wxhtml
```

生成：

| 文件 | 用途 |
| --- | --- |
| `攻略.inline.html` | 单文件预览 / 发给别人（图已内嵌） |
| `攻略.inline.wxhtml` | 改名为 `.html` 后浏览器打开 → Ctrl+A → Ctrl+C → 粘贴公众号 |

规则：最长边约 1200px、JPEG 质量约 75。外链图与已是 `data:` 的图会跳过。

## 远程

https://github.com/LostEvangel/lost-cherry-travels

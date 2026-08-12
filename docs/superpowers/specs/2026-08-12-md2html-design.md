# Markdown → HTML 导出（mdflow）

**日期：** 2026-08-12  
**状态：** 已采用  
**工具：** [@rongyan/mdflow-cli](https://www.npmjs.com/package/@rongyan/mdflow-cli)（现成 CLI，不自写脚本）

## 目标

本地预览、单页分享、公众号粘贴，默认偏杂志暖色。

## 安装

```bash
npm i -g @rongyan/mdflow-cli
```

## 推荐命令（杂志暖色）

```bash
mdflow trips/2026-烟台威海/攻略.md --theme=优雅 --primary-color=活力橘 --wxoutput
```

输出（与 Markdown 同目录）：

| 文件 | 用途 |
| --- | --- |
| `攻略.html` | 浏览器预览 / 发给别人 |
| `攻略.wxhtml` | 打开后全选复制 → 粘贴公众号编辑器 |

## 其它常用选项

- `--theme`：`经典` / `优雅` / `简洁`
- `--primary-color`：`活力橘`、`玫瑰金`、`樱花粉` 等（暖色系优先）
- `--font-family`：`无衬线` / `衬线` / `等宽`
- `--font-size`：`推荐`（默认）等

完整帮助：`mdflow --help`

## 说明

- 发给别人时请连同 `assets/` 一起打包（HTML 里图片仍是相对路径）
- 微信编辑器可能过滤部分样式；以 `.wxhtml` 粘贴效果为准
- 本仓库不维护自研转换脚本

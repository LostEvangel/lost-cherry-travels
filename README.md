# lost-cherry-travels

个人旅行笔记合集：出发前计划、分享向回顾攻略、配图都按行程归档。

## 行程索引

| 行程 | 状态 | 一句话 |
| --- | --- | --- |
| [2026 · 烟台威海五日](./trips/2026-烟台威海/) | 定稿 | 海岸线 + 转场 + 荣成自驾 |
| [2026 · 开封郑州洛阳](./trips/2026-开封郑州洛阳/) | 大纲中 | 开封 + 郑州 + 洛阳，顺路胖东来 |

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
mdflow trips/2026-烟台威海/攻略.md --theme=优雅 --primary-color=活力橘 --wxoutput
```

同目录生成 `攻略.html`（预览/分享）和 `攻略.wxhtml`（公众号粘贴用）。发给别人时请连同 `assets/` 一起打包。

## 远程

https://github.com/LostEvangel/lost-cherry-travels

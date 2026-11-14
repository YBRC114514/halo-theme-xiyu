# 悠哉字体 Yozai · 第三方字体声明

本目录下的 `.woff2` 字体分片来自 **悠哉字体（Yozai）**，按 **SIL Open Font License 1.1** 授权，
随「熹屿 Xiyu」Halo 主题（`theme-xiyu`）一起分发。

| 项目 | 内容 |
| --- | --- |
| 字体名称 | 悠哉字体 / Yozai |
| 版权 | Copyright 2020, 2024 LXGW（https://github.com/lxgw/yozai-font）<br>Copyright (c) 2021-03-07, Y.Oz (Y.OzVox)（http://yozvox.web.fc2.com） |
| 保留字体名 | 含 `Y.Oz` / `YOz` 的字样为 Reserved Font Name |
| 上游项目 | https://github.com/lxgw/yozai-font |
| 分片来源 | npm 包 `cn-fontsource-yozai-regular@1.0.9`（按 `unicode-range` 把原字体切成 258 个 woff2 分片，字形未改动） |
| 许可全文 | 同目录 `OFL.txt`（SIL Open Font License 1.1） |

## 主题对这些文件做了什么

**没有做任何改动。** 文件名、字体族名（`Yozai`）、字形数据都与上游发布版本一致，
主题只是把分片原样打包进主题包，并在 `yozai.css` 里按 `unicode-range` 引用：

- 不改名（不使用新的字体族名，也不使用保留字体名派生的新名称）；
- 不改字形、不做二次子集化、不重新编码；
- 随包附带本声明与 OFL 1.1 许可全文。

## 移除请求

若你是字体作者或权利人，希望本主题停止分发该字体，请联系仓库维护者
（https://github.com/YBRC114514/halo-theme-xiyu/issues），我们会立即从后续版本中删除。

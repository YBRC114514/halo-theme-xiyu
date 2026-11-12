<p align="center">
  <img src="assets/icon-128.png" width="96" height="96" alt="熹屿 Xiyu" />
</p>

# 熹屿 Xiyu

一座为文字留白的岛 —— 面向 Halo 2.26+ 的响应式博客主题：杂志式首屏、克制的卡片流、清透的青蓝配色与柔和暗色模式，配合滑动高亮目录、文章入场动效、创作日历、友链自助申请与朋友圈订阅聚合。

- 主题标识：`theme-xiyu`
- 显示名称：熹屿 Xiyu
- 当前版本：1.0.16
- 要求：Halo `>= 2.26.0`（2.27.2 实测；评论组件 Next 需 `>= 2.27.0`）
- 许可：[MIT](LICENSE)

## 安装

1. 下载本仓库 `dist/theme-xiyu-1.0.16.zip`（或自行构建，见下）。
2. 在 Halo 控制台进入「外观 → 主题 → 安装」，上传该 ZIP（无需解压）。
3. 安装完成后点击「启用」。
4. 进入「外观 → 主题 → 设置」按需调整各分组选项。

升级同样通过「安装」上传新版本 ZIP，Halo 会保留已有配置。

> 注意：Halo 以 `metadata.name` 作为主题身份。若你此前安装过 `theme-azure-isle`（本主题的旧标识），它无法直接升级到本包，需先卸载旧主题再安装；旧配置也不会自动迁移，可在安装后重新设置。

## 功能

- **首屏**：可自定义标题、副标题、背景图与首屏高度，支持关闭 Banner 直接进入内容。
- **文章列表**：网格 / 列表双视图切换（带过渡动画），摘要两行截断。分页直接使用 Halo 内置 `posts.prevUrl` / `posts.nextUrl`，**每页文章数由 Halo 后台「设置 → 文章设置」统一控制**，主题不再提供可能与之冲突的独立选项。
- **文章页**：滑动高亮目录（长目录自动跟随、不整页跳动）、代码块复制、图注、上下篇导航。
- **导航**：桌面端胶囊菜单支持鼠标悬停展开二级菜单；触屏设备使用「电脑模式 / 桌面版网站」时改为点按展开（第一次点按展开子菜单，第二次点按父项才跳转），手机 / 平板仍是抽屉导航。
- **浮动按钮**：可选「返回顶部」或「返回文章列表」；后者仅在首页生效，点击后平滑滑到文章列表并跳过首屏 Banner，其他页面一律回到顶部。
- **作者页**：关于栏以两栏卡片呈现介绍、联系方式与社交入口。
- **友链页**：自助申请（含验证码）、站点信息、友链规则，分组紧凑卡片排版。
- **朋友圈页**（自定义模板 `friends.html`）：聚合 Halo 官方链接插件订阅的 RSS 动态。
- **暗色模式**：亮 / 暗双套配色，遵循系统偏好并可手动切换。
- **可访问性**：唯一 `h1`、地标完整、跳过导航链接、可见焦点轮廓、正文与次要文字对比度满足 WCAG AA。

## 插件兼容

| 插件 | 标识 / 版本 | 主题提供的能力 |
| --- | --- | --- |
| `plugin-links`（Halo 官方链接插件） | `PluginLinks` 2.5.0 | 友链页 `links.html`、朋友圈 `friends.html` 的 RSS 动态与匿名申请接口 |
| `plugin-equipment` | 1.1.1 | 装备页 `equipments.html` |
| `plugin-steam` | 1.0.0 | Steam 游戏页 `steam.html` |
| `plugin-comment-next` | `PluginCommentNext` 1.1.1，Halo ≥2.27 | 文章 / 独立页 `<halo:comment />` 评论区、评论框配色变量、侧栏「评论读者榜」 |
| `plugin-moments` | `PluginMoments` 1.19.0 | `/moments` 列表页 `moments.html`、`/moments/{name}` 详情页 `moment.html`、侧栏「最新瞬间」 |
| `plugin-hitokoto-hub`（轻言） | `hitokoto-hub` 3.0.0 | 侧栏「一言」（服务端 Finder 渲染 +「换一句」公开 API）、页脚入口 |

主题不依赖任何插件：以上插件全部未安装时，首页、文章、归档、分类、标签、作者页等核心页面照常工作。

### 关于「未安装插件」的实际行为

这一点需要区分两类页面，主题的表现并不相同：

1. **插件注册的路由页面** —— `/links`（plugin-links）、`/equipments`（plugin-equipment）、`/steam`（plugin-steam）、`/moments` 与 `/moments/{name}`（plugin-moments）、`/hitokoto`（plugin-hitokoto-hub，页面由插件自带模板渲染）。这些 URL 由插件在启用时注册，主题只负责提供模板 / 数据展示。**插件未安装或未启用时路由根本不存在，访问会得到 404，模板不会渲染，也不会出现「空态提示」。** 请先启用插件，再到「外观 → 菜单」把对应路径加入导航；`/moments` 的列表与详情模板由本主题提供，`/hitokoto` 则由插件自带页面呈现，视觉可能与主题其余页面略有差异。
2. **主题内的可选模块 / 独立页** —— 侧栏「一言」「最新瞬间」「评论读者榜」、页脚插件入口，以及文章 / 独立页的评论区。这些位置都用 `pluginFinder.available()` 做了守卫，插件未启用时**整块不渲染**，其余内容不受影响。用户自行创建的独立页（例如选择 `friends.html` 的 `/friends` 朋友圈页）即使插件未启用也能打开，只是动态数据请求失败时列表为空。

另外：评论组件 Next 实现的是 Halo 的 `comment-widget` 扩展点，主题已在 `post.html` / `page.html` 输出 `<halo:comment />`，安装并启用插件后评论区会自动换成新版组件；Halo 自带的 `PluginCommentWidget` 与它请不要同时启用。

### 插件联动设置

后台「主题设置 → 插件联动」可分别开关侧栏「一言」「最新瞬间」「评论读者榜」与页脚插件入口，并设置瞬间条数、读者榜周期与人数。所有开关都只在对应插件已启用时生效。

## 本地开发

```bash
npm install
npm run build-only   # 仅构建 templates/
npm run build        # 构建并打包 dist/theme-xiyu-<version>.zip
npm run dev          # watch 模式，边改边构建
```

模板使用 Thymeleaf 原生布局契约：页面通过 `~{layout :: html(head = ~{::head}, content = ~{::content})}` 复用 `templates/layout.html`，公共片段位于 `src/partials/`，由构建期 `<include>` 展开。

## 目录结构

```
├── src/                 # 源码（Thymeleaf 模板、partials、CSS、TS）
│   ├── partials/        # 公共片段，构建期被 include 展开
│   ├── moments.html     # plugin-moments 列表页模板
│   ├── moment.html      # plugin-moments 详情页模板
│   ├── css/main.css     # 亮/暗双套变量的主样式
│   └── js/main.ts       # 交互：导航抽屉与二级菜单、目录高亮、视图切换、插件模块等
├── public/              # 原样复制的静态资源
│   ├── assets/gateway.css
│   ├── assets/logo.svg  # 主题标识（线条版，随文字颜色变化）
│   ├── assets/favicon.svg  # 站点图标（深底圆形，未设置站点 favicon 时兜底）
│   └── error/error.html # 错误页（独立骨架）
├── assets/              # 品牌素材：icon-{512..16}.png 与 social-preview.png
├── templates/           # 构建产物：最终主题模板与哈希资源
├── dist/                # 构建产物：可安装的 ZIP
├── theme.yaml           # 主题元信息（标识、版本、配置资源名）
├── settings.yaml        # 后台设置表单（FormKit）
└── screenshot.png       # 主题预览图
```

`templates/` 与 `dist/` 已在仓库中保留一份构建结果，便于直接取用；修改 `src/` 后请重新构建，避免两者不一致。

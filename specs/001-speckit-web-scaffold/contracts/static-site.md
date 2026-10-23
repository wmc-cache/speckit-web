# 静态站点输出契约（静态发布模式）

**对应需求**: FR-009、FR-010、FR-018 | **数据格式**: [data-api.md](./data-api.md)、[data-model.md](../data-model.md)

`speckit-web build` 的输出目录结构如下，是一个可直接放到任意静态托管（含子路径）的自包含站点。

```text
speckit-site/
├── index.html                 # 预构建前端，<meta name="speckit-web-mode" content="static">
├── assets/                    # 前端 JS/CSS（带内容哈希的文件名）
├── data/
│   ├── project.json           # 等价于 GET /api/project
│   ├── features/<featureId>.json   # 等价于 GET /api/features/:featureId（featureId 经 encodeURIComponent）
│   ├── docs/<docId>.json      # 等价于 GET /api/docs/:docId；超大文档另有 <docId>.part-<k>.json
│   └── search.json            # SearchIndex[]，首次搜索时懒加载
├── .nojekyll                  # 让 GitHub Pages 不过滤以下划线开头的文件
└── .speckit-web-build         # 构建标记，含版本与时间；用于安全清空输出目录
```

## 约束

1. **只含白名单文档**：数据文件只包含准则与 `specs/**` 下白名单扩展名的文档（与本地模式扫描规则相同）；不得复制任何项目源文件本身，也不得包含绝对路径、主机名、用户名等本机信息。
2. **相对路径**：`index.html` 引用的资源与数据均为相对路径；路由使用 hash（`#/f/<featureId>/<artifact>?h=<anchor>`），因此部署在 `https://<用户>.github.io/<仓库>/` 等子路径下无需额外配置。
3. **未发布的链接**：文档中指向非白名单文件的相对链接，在渲染时改写为带 `data-unpublished` 标记的不可点击文本，悬停提示“该文件未发布”。
4. **无写入入口**：静态模式隐藏初始化向导与实时刷新指示，不发起任何 `/api/*` 请求。
5. **确定性**：同一份输入两次构建，除 `.speckit-web-build` 与 `generatedAt` 外输出逐字节一致（便于缓存与审查差异）。

## GitHub Pages 发布示例

仓库提供 `examples/github-pages.yml`，用户复制到自己项目的 `.github/workflows/` 即可：在推送到默认分支且 `specs/**` 或 `.specify/memory/**` 有变化时，执行 `npx speckit-web@<主版本> build . --out _site`，再用 `actions/upload-pages-artifact` 与 `actions/deploy-pages` 发布。

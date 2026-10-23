# 研究记录: Spec Kit Web 文档查看与项目初始化开源脚手架

**特性**: [spec.md](./spec.md) | **方案**: [plan.md](./plan.md) | **日期**: 2026-10-23

每条按“决定 / 理由 / 考虑过的替代方案”记录。技术上下文中的所有未知项均已在此解决。

---

## R1. 运行时与语言

- **决定**: Node.js ≥ 22（截至 2026-10，Node 20 已于 2026-04 停止维护，22 与 24 为在维护的 LTS），全部代码使用 TypeScript 5.x（严格模式），以 ESM 发布。
- **理由**: 目标用户都装有 Node，`npx speckit-web` 无需安装即可运行，满足 FR-030“一条命令在任意项目上启动”；前后端同语言，解析逻辑可在本地服务、静态构建两处复用。
- **替代方案**: Python（与官方 `specify` 同生态，但网页前端仍需 JS 工具链，且 `pipx/uvx` 分发网页资源不如 npm 自然）；Go 单文件二进制（分发方便，但前端仍是两套语言，贡献门槛高）。

## R2. 包结构与分发

- **决定**: 单个 npm 包 `speckit-web`（已确认 npm 上未被占用），提供可执行命令 `speckit-web`；网页前端在发布前预构建好随包分发，用户侧不需要任何前端构建工具。仓库同时开启 GitHub “Template repository”。
- **理由**: 单包最容易理解和贡献；预构建前端让 `serve` 与 `build` 都只是“拷贝静态资源 + 生成数据”，启动快（SC-002）。
- **替代方案**: pnpm monorepo 拆成 core / server / web / cli 多包（边界清晰但对小项目是过度设计，见 plan 复杂度说明）；`create-speckit-web` 生成器（只覆盖初始化，不覆盖查看）。

## R3. 前端技术

- **决定**: Vite 6 + React 19 + TypeScript；路由用 wouter 的 hash 模式（`#/f/001-x/spec`）；样式用原生 CSS 变量实现浅色/深色主题；不引入大型 UI 库，下拉框、对话框等用自写组件（遵循“不用浏览器原生下拉框”的约定：自定义面板、主题配色、当前项打勾、键盘上下选择、Esc 关闭）。
- **理由**: hash 路由在 GitHub Pages 子路径下无需 404 回退技巧即可直达任意页面（对应边界情况“子路径部署”）；React 生态贡献者最多；自写少量组件可控制体积。
- **替代方案**: Vue/Svelte（同样可行，社区规模略小）；History 路由（静态托管需要 404.html 重定向技巧，容易出错）；VitePress/Docusaurus 等文档站框架（难以做进度总览、实时刷新和初始化向导这类应用型功能）。

## R4. Markdown 渲染位置与工具链

- **决定**: 在 Node 侧（core 模块）用 unified 管线渲染：`remark-parse` → `remark-gfm` → 自定义 Spec Kit 插件（锚点、编号链接、相对链接改写、待澄清标记高亮）→ `remark-rehype` → `rehype-sanitize` → `@shikijs/rehype`（浅/深双主题）→ HTML。Mermaid 代码块在浏览器端按需懒加载渲染。
- **理由**: 渲染只写一份，本地模式即时渲染、静态模式预渲染，两种形态结果完全一致（FR-009）；浏览器端不加载 Markdown 解析器，首屏更快；`rehype-sanitize` 防止文档中的原始 HTML 造成 XSS（静态站点公开发布时尤为重要）。
- **替代方案**: 浏览器端渲染（静态站点也能用，但每次打开都要解析，且需在前端打包整套 unified）；markdown-it（插件生态好，但与本项目所需的 AST 级分析（提取任务、编号）不如 mdast 方便，分析和渲染会变成两套解析）。

## R5. Spec Kit 结构解析规则

- **决定**: 以 `.specify/` 目录存在作为“是 Spec Kit 项目”的判定条件；`specs/` 可不存在（官方 `specify init` 刚执行完时并不会创建 `specs/`，已实测确认）。特性目录名匹配 `^(\d{3,})-(.+)$`（顺序编号）或 `^(\d{8}-\d{6})-(.+)$`（时间戳），不匹配的目录作为“未识别目录”列在末尾而非忽略。读取 `.specify/feature.json` 标记“当前特性”，读取 `.specify/init-options.json` 获取 AI 助手、脚本类型、编号方式与 Spec Kit 版本。
- **理由**: 与官方 1.x 约定一致；对不规范命名宽容处理，避免用户以为文档“丢了”。
- **替代方案**: 以 `specs/` 存在作为判定（新初始化项目会被误判为非 Spec Kit 项目）。

## R6. 阶段判定

- **决定**: 阶段按产物推断（详见 data-model.md 的“阶段判定规则”）：准则（项目级，constitution 已填写）→ 规范（spec.md）→ 澄清（spec.md 含 `## Clarifications`）→ 方案（plan.md）→ 检查清单（`checklists/` 下除 `requirements.md` 外还有其它清单）→ 任务（tasks.md）→ 分析（无文件产物，显示为“可选·无法自动判断”）→ 实现（tasks.md 中至少一项已勾选；全部勾选为“已完成”）。
- **理由**: `/speckit-analyze` 只在对话中输出报告、不落盘，无法从文件判断，如实标注比猜测更可信；`requirements.md` 由规范步骤自动生成，不能代表检查清单步骤已执行。
- **替代方案**: 读取 AI 对话记录或 git 历史判断（超出“只看项目文件”的边界，且不可移植）。

## R7. 本地服务

- **决定**: Hono + `@hono/node-server` 提供 JSON 接口与静态资源；chokidar 4 监听 `.specify/memory/`、`.specify/*.json` 与 `specs/`，200 ms 去抖后通过 SSE（Server-Sent Events）推送变更；默认端口 5178，被占用时自动递增寻找可用端口。
- **理由**: Hono 体积小、类型友好；SSE 单向推送足够且无需额外依赖，浏览器原生支持自动重连；满足 SC-004（2 秒内反映变化）。
- **替代方案**: Express（更重、类型差）；WebSocket（双向能力用不上）；轮询（延迟和开销更差）。

## R8. 本地服务安全

- **决定**:
  1. 只监听 `127.0.0.1`；校验 `Host` 头只接受 `localhost` / `127.0.0.1` / `[::1]`，防 DNS 重绑定攻击。
  2. 文件访问采用“白名单索引”：只能读取扫描阶段登记过的文档（constitution 与 `specs/**` 下的 `.md/.yaml/.yml/.json/.graphql/.proto/.txt`），请求参数是文档 ID 而不是任意路径；扫描时对每个文件 `realpath` 后确认仍在项目根目录内，越界的符号链接直接跳过。
  3. 永远排除 `.git/`、`node_modules/`、`.env*`、以及 `.specify/` 下除 memory 与配置 JSON 外的内容。
  4. 唯一的写操作（网页初始化）要求 POST + 启动时生成的随机令牌（写入页面、放在请求头），并且只能作用于启动目录或其新建子目录。
- **理由**: 本机服务可被任意网页通过浏览器访问，必须防跨站请求与路径穿越（FR-007、FR-008、SC-010）。
- **替代方案**: 基于路径的读取 + 规范化检查（易被符号链接、编码绕过，白名单更稳）。

## R9. 静态发布

- **决定**: `speckit-web build` 复制预构建前端到输出目录（默认 `./speckit-site`），并把同样的数据接口结果写成 JSON 文件（`data/project.json`、`data/docs/<文档ID哈希>.json`、`data/search.json`）。前端通过 `DataSource` 接口在“本地接口”与“静态文件”两种实现间切换，页面根据 `data/project.json` 中的 `mode` 字段自动识别。资源全部使用相对路径（Vite `base: './'`），配合 hash 路由支持任意子路径部署。仓库提供 `examples/github-pages.yml` 工作流示例（`actions/upload-pages-artifact` + `actions/deploy-pages`）。
- **理由**: 两种形态共用一份前端和数据格式（FR-009 体验一致）；静态站点只含白名单文档，不会泄漏源码（FR-010）。
- **替代方案**: 为每篇文档生成独立 HTML（利于搜索引擎，但与 SPA 共享代码困难；文档站公开收录也非本项目诉求）。

## R10. 全文搜索

- **决定**: 搜索索引为“文档 ID + 标题 + 去除 Markdown 标记的纯文本 + 标题位置表”的 JSON；在浏览器 Web Worker 中做大小写不敏感、全角半角归一化后的子串匹配，按标题命中 > 正文命中排序，返回带上下文的片段。本地模式由服务端在内存中维护同样的索引并通过接口查询；静态模式在第一次搜索时懒加载 `data/search.json`。
- **理由**: 中文无需分词即可准确命中（“登录”不会因分词器不同而漏检）；500 篇文档约数 MB 文本，子串扫描在毫秒到几十毫秒级，满足 SC-003。
- **替代方案**: MiniSearch / FlexSearch 倒排索引（中文需要额外分词或 n-gram，索引体积反而更大，准确性取决于分词器）；Lunr（中文支持差）。

## R11. 初始化编排

- **决定**: 完全委托官方 `specify` CLI，不自带模板（与规范假设一致）。流程：
  1. **探测**：优先使用 PATH 上的 `specify`；否则若有 `uvx`，使用 `uvx --from git+https://github.com/github/spec-kit.git specify`（首次需联网）；两者都没有则报告缺失，并给出 uv 与 specify-cli 的安装命令（区分 macOS/Linux/Windows）。
  2. **暂存**：在系统临时目录执行 `specify init <tmp>/<name> --integration <key> --script <sh|ps|py> --ignore-agent-tools`，标准输入关闭以确保非交互（已实测：本机 specify 0.16.4 离线完成仅约 0.3 秒，生成 `.specify/` 与 `.claude/` 等文件）。
  3. **预览**：把暂存结果与目标目录逐文件比对，得到“新增 / 覆盖 / 相同”清单，目标非空或已有 `.specify/` 时必须展示并等待确认（FR-023）。
  4. **应用**：确认后将暂存文件复制到目标目录；若选择时间戳编号，再改写 `.specify/init-options.json` 的 `feature_numbering`（官方 CLI 没有对应参数，但该文件即官方读取的配置）。复制前先把将被覆盖的文件备份到临时目录，复制中途失败则还原并删除新增文件（FR-026）。
  5. **清理**：无论成功失败都删除暂存目录。
- **理由**: 生成结果与官方完全一致（FR-024、SC-008）；“暂存 → 预览 → 应用”天然支持覆盖预览和失败回滚；官方 CLI 已离线打包模板，安装后的初始化不需要联网。
- **替代方案**: 直接在目标目录运行 `specify init --here --force`（无法预先列出覆盖清单，失败会留下半成品）；自行打包模板（会与官方版本脱节，违背假设）。

## R12. 可选 AI 助手列表

- **决定**: 随包内置一份 AI 助手清单快照（key、显示名、是否需要 CLI，来源于 `specify integration list`），每次发布时由脚本刷新；运行时若检测到本机 `specify`，再解析其 `integration list` 输出补充新增项；向导中另提供“其它（手动输入 key）”。默认选 `claude`。
- **理由**: 官方命令没有机器可读输出格式，纯运行时解析脆弱；快照 + 运行时补充兼顾稳定与新鲜。
- **替代方案**: 只用运行时解析（表格格式变化即失效）；只用快照（新助手要等本项目发版）。

## R13. 命令行交互

- **决定**: 命令解析用 `cac`，交互问答用 `@clack/prompts`；所有交互项都有对应参数，并支持 `--yes` 全部取默认值，非 TTY 环境自动进入非交互模式，缺少必填项时以退出码 2 报错。
- **理由**: 依赖小、Windows 兼容好；满足 FR-020 的“脚本化与持续集成”。
- **替代方案**: commander + inquirer（更重）；yargs（API 偏繁琐）。

## R14. 国际化与主题

- **决定**: 自写轻量 i18n（`zh-CN.json` / `en.json` 两份字典 + 带插值的 `t()`），按 `navigator.language` 选择默认语言，手动切换存 `localStorage`；CLI 输出语言按 `LANG`/`LC_ALL` 选择。主题用 CSS 变量，默认跟随 `prefers-color-scheme`，可手动切换。
- **理由**: 只有两种语言、文案量小，不值得引入 i18next；满足 FR-031、FR-032。
- **替代方案**: i18next / react-intl（功能过剩）。

## R15. 测试策略

- **决定**: Vitest 做单元与集成测试（解析器、阶段判定、计数、路径安全、初始化编排——`specify` 以假可执行文件替身）；Playwright 做端到端测试，覆盖本地模式、静态构建产物（用本地静态服务器在子路径下托管）与网页向导；测试夹具为 `tests/fixtures/` 下的多个 Spec Kit 项目（含时间戳编号、未填写准则、中文与空格路径、越界符号链接、超大文档等边界情况）。
- **理由**: 计数准确性（SC-006）与安全性（SC-010）必须由自动化测试守护；端到端测试验证两种形态体验一致。
- **替代方案**: Jest（ESM/TS 配置更繁琐）；Cypress（多标签页与 SSE 场景不如 Playwright）。

## R16. 开源工程配套

- **决定**: MIT 许可；README 中英双语（`README.md` 英文为主、`README.zh-CN.md` 中文）；`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`（Contributor Covenant 2.1）、`SECURITY.md`、Issue 表单与 PR 模板；GitHub Actions：`ci.yml`（Ubuntu/macOS/Windows × Node 22/24 运行 lint、类型检查、单元、端到端测试）、`release.yml`（Changesets 管理版本与 CHANGELOG，并发布到 npm，使用 npm provenance）、`pages.yml`（用本工具发布内置示例项目的在线演示）。
- **理由**: 满足 FR-027～FR-029 与 SC-001；在线演示让访客不安装也能先看到效果。
- **替代方案**: release-please（同样可行，Changesets 对贡献者更直观）。

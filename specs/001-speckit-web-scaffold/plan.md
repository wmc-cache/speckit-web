# Implementation Plan: Spec Kit Web 文档查看与项目初始化开源脚手架

**Branch**: `001-speckit-web-scaffold` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-speckit-web-scaffold/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

做一个以 npm 包 `speckit-web` 发布的 GitHub 开源工具，提供三条命令：`serve`（本地模式，浏览 Spec Kit 项目文档并实时刷新）、`build`（把文档导出为可部署到 GitHub Pages 子路径的静态站点）、`init`（委托官方 `specify` CLI 初始化项目，支持命令行与网页向导两种入口）。

技术路线：TypeScript 全栈。Node 侧的 core 模块负责扫描 Spec Kit 目录、解析任务/清单/编号、判定阶段并用 unified 渲染 Markdown；本地服务（Hono + SSE + chokidar）与静态构建共用 core 的输出，前端（Vite + React）通过 `DataSource` 抽象在“本地接口”与“静态 JSON”间切换，保证两种形态体验一致。初始化采用“临时目录暂存 → 比对预览 → 确认应用 → 失败回滚”的流程，保证结果与官方一致且不留半成品。

## Technical Context

**Language/Version**: TypeScript 5.x（strict），运行于 Node.js ≥ 22（Node 20 已停止维护）；前端目标为近两年的主流桌面浏览器（Chrome/Edge/Firefox/Safari 最新两个大版本）

**Primary Dependencies**:
- 解析与渲染：unified、remark-parse、remark-gfm、remark-rehype、rehype-sanitize、@shikijs/rehype、mermaid（浏览器端懒加载）
- 本地服务：hono、@hono/node-server、chokidar 4
- 命令行：cac、@clack/prompts、open
- 前端：react 19、vite 6、wouter（hash 路由）
- 初始化：官方 `specify` CLI（外部依赖，运行时探测；缺失时可经 `uvx` 调用）

**Storage**: 无数据库。数据来源为项目文件（只读）；静态模式输出 JSON 文件；本地模式索引驻留内存

**Testing**: Vitest（单元与集成）、Playwright（端到端，本地模式 / 静态子路径 / 网页向导）、`tests/fixtures/` 下的多套 Spec Kit 夹具项目

**Target Platform**: macOS、Linux、Windows 上的 Node.js 命令行；静态站点可部署到 GitHub Pages 等任意静态托管

**Project Type**: 命令行工具 + 内嵌 Web 单页应用（单一 npm 包）

**Performance Goals**: 启动到可见总览 ≤ 10 秒（SC-002，目标 ≤ 2 秒）；50 特性 / 500 文档时打开文档与搜索 ≤ 1 秒（SC-003）；文件变更到页面更新 ≤ 2 秒（SC-004）；单次初始化 ≤ 2 分钟（SC-008，实测 specify 本身约 0.3 秒）

**Constraints**: 浏览功能严格只读；只监听 127.0.0.1 并校验 Host；只读白名单文档；渲染结果必须净化；静态站点只用相对路径与 hash 路由；不使用浏览器原生 `<select>` 下拉框（改用自定义下拉面板）；界面中/英双语、浅/深色主题；npm 包安装体积目标 < 15 MB（Shiki 语言按需打包）

**Scale/Scope**: 单项目查看；按 50 特性 / 500 文档 / 单文档 1 MB 设计与压测；约 8 个前端页面/视图（总览、特性、文档、准则、搜索、初始化向导、未检测到项目、错误页）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` 目前仍是未填写的模板（全部为 `[PRINCIPLE_N_NAME]` 等占位符），**没有可执行的准则条款，因此无准则门禁可评估，也不存在违反项**。

在准则建立之前，本方案采用以下从规范推导出的临时门禁，作为 Phase 0 前与 Phase 1 后的自检：

| 门禁 | Phase 0 前 | Phase 1 后 | 依据 |
|---|---|---|---|
| 浏览功能只读，唯一写入点（初始化）需显式确认 | ✅ 已纳入约束 | ✅ 契约中仅 `POST /api/init/apply` 写入，且需令牌 + 确认 | FR-007、FR-023 |
| 不暴露项目外文件与敏感文件 | ✅ | ✅ 只按 Document ID 读取，白名单扫描 + realpath 校验 | FR-008、FR-010、SC-010 |
| 两种查看形态共用同一数据格式与前端 | ✅ | ✅ `DataSource` 抽象，接口与静态 JSON 载荷一致 | FR-009 |
| 初始化结果与官方一致 | ✅ | ✅ 完全委托 `specify`，不自带模板 | FR-024、SC-008 |
| 关键计数与安全有自动化测试 | ✅ | ✅ quickstart 场景 2、8 对应测试套件 | SC-006、SC-010 |

**结论**: 通过。⚠️ 建议在 `/speckit-tasks` 之前运行 `/speckit-constitution` 建立正式准则，届时需要重新执行本检查。

## Project Structure

### Documentation (this feature)

```text
specs/001-speckit-web-scaffold/
├── plan.md              # 本文件
├── research.md          # Phase 0：技术决策
├── data-model.md        # Phase 1：数据模型与阶段判定规则
├── quickstart.md        # Phase 1：端到端验证手册
├── contracts/           # Phase 1：对外接口契约
│   ├── cli.md           #   命令行
│   ├── data-api.md      #   本地数据接口
│   └── static-site.md   #   静态站点输出结构
├── checklists/
│   └── requirements.md  # 规范质量检查清单
└── tasks.md             # Phase 2 输出（/speckit-tasks 生成，本命令不创建）
```

### Source Code (repository root)

```text
src/
├── core/                    # 与运行形态无关的纯逻辑（Node 侧）
│   ├── scan.ts              #   项目识别、白名单扫描、realpath 越界检查
│   ├── features.ts          #   特性目录解析与排序
│   ├── parse/               #   tasks / checklists / spec 摘要 / constitution / 待澄清标记
│   ├── stage.ts             #   阶段判定
│   ├── render/              #   unified 管线与 Spec Kit 自定义插件（锚点、编号链接、相对链接改写）
│   ├── search.ts            #   索引构建与子串匹配（前端 Worker 复用同一实现）
│   └── model.ts             #   共享类型（与 data-model.md 一一对应）
├── server/                  # 本地模式
│   ├── app.ts               #   Hono 路由、Host 校验、令牌校验
│   ├── watch.ts             #   chokidar 监听 + 去抖 + SSE 推送
│   └── port.ts              #   端口探测
├── build/
│   └── export.ts            # 静态站点导出
├── init/
│   ├── runner.ts            #   specify / uvx 探测与调用
│   ├── integrations.ts      #   内置助手清单快照 + 运行时补充
│   ├── plan.ts              #   暂存与比对
│   └── apply.ts             #   应用、备份与回滚
├── cli/
│   ├── index.ts             #   cac 命令入口（serve / build / init）
│   └── prompts.ts           #   @clack/prompts 交互
└── i18n/                    # 命令行文案（zh-CN / en）

web/                         # 前端单页应用（Vite + React），发布前预构建到 dist/web
├── index.html
└── src/
    ├── data/                #   DataSource 接口及 LocalSource / StaticSource 实现
    ├── routes/              #   总览、特性、文档、准则、搜索、初始化向导、未检测到项目
    ├── components/          #   导航、目录大纲、进度条、阶段条、自定义下拉框、对话框
    ├── workers/search.ts    #   静态模式搜索 Worker（调用 core/search 的匹配实现）
    ├── i18n/                #   界面文案（zh-CN / en）
    └── styles/              #   CSS 变量主题（浅 / 深）

examples/
├── demo-project/            # 内置示例 Spec Kit 项目（覆盖全部阶段与边界情况）
└── github-pages.yml         # 用户可复制的 Pages 发布工作流

tests/
├── fixtures/                # 夹具项目（时间戳编号、未填写准则、中文空格路径、越界符号链接、超大文档、50×500 性能夹具生成器）
├── unit/                    # core 解析、计数、阶段、搜索、渲染净化
├── integration/             # server 接口、安全、build 输出、init 编排（specify 替身）
└── e2e/                     # Playwright：本地模式、静态子路径、网页向导

scripts/
└── sync-integrations.ts     # 发布前刷新 AI 助手清单快照

.github/
├── workflows/ci.yml         # 三平台 × Node 22/24：lint、类型检查、测试、端到端
├── workflows/release.yml    # Changesets 版本管理 + npm 发布（provenance）
├── workflows/pages.yml      # 发布示例项目在线演示
├── ISSUE_TEMPLATE/          # 缺陷 / 功能建议表单
└── PULL_REQUEST_TEMPLATE.md

README.md · README.zh-CN.md · LICENSE · CONTRIBUTING.md · CODE_OF_CONDUCT.md · SECURITY.md · CHANGELOG.md
package.json · tsconfig.json · vite.config.ts · vitest.config.ts · playwright.config.ts
```

**Structure Decision**: 采用单一 npm 包、`src/`（Node 侧）与 `web/`（前端）并列的结构。`src/core` 是不依赖运行形态的纯逻辑，被 `server`、`build`、`init` 以及前端搜索 Worker 共用，这是“两种形态体验一致”（FR-009）的关键；`web/` 预构建后随包发布，用户侧无需前端工具链。未拆分为 monorepo 多包，原因见 research R2。

## Phase 0 / Phase 1 产物

- Phase 0：[research.md](./research.md) —— R1～R16 共 16 项决策，技术上下文中无遗留的 NEEDS CLARIFICATION。
- Phase 1：[data-model.md](./data-model.md)、[contracts/cli.md](./contracts/cli.md)、[contracts/data-api.md](./contracts/data-api.md)、[contracts/static-site.md](./contracts/static-site.md)、[quickstart.md](./quickstart.md)。

### 需求覆盖对照

| 需求 | 设计落点 |
|---|---|
| FR-001～FR-006 | core/scan、features、render；data-model §1～§4 |
| FR-007、FR-008 | research R8；data-api 通用约定 |
| FR-009、FR-010 | research R9；contracts/static-site |
| FR-011 | server/watch；data-model §11；data-api `/api/events` |
| FR-012～FR-017 | core/parse、stage；data-model §5～§8 |
| FR-018、FR-019 | core/search、render 编号插件；data-model §9 |
| FR-020～FR-026 | src/init；research R11～R13；contracts/cli `init`；data-api `/api/init/*`；data-model §10 |
| FR-027～FR-030 | research R2、R16；`.github/`、`examples/` |
| FR-031、FR-032 | research R14 |

## Complexity Tracking

无准则违反项，无需记录。

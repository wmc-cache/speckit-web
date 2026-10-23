---

description: "Spec Kit Web 文档查看与项目初始化开源脚手架的任务清单"
---

# Tasks: Spec Kit Web 文档查看与项目初始化开源脚手架

**Input**: Design documents from `/specs/001-speckit-web-scaffold/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 包含测试任务。规范的 SC-006（计数 100% 准确）、SC-010（安全）、SC-003/SC-004（性能与实时刷新）以及 FR-029（合并请求自动运行测试）都要求自动化验证，quickstart.md 也引用了对应的测试套件；测试聚焦这些关键点，不追求全量 TDD。

**Organization**: 任务按用户故事分组，每个故事可独立实现与验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、不依赖未完成的任务）
- **[Story]**: 所属用户故事（US1～US5）
- 描述中给出确切文件路径

## Path Conventions

- 单一 npm 包：Node 侧代码在 `src/`，前端在 `web/`，测试在 `tests/`，示例在 `examples/`（见 plan.md 的 Project Structure）
- 共享类型以 `src/core/model.ts` 为准，与 data-model.md 一一对应
- 接口与命令行行为以 `contracts/cli.md`、`contracts/data-api.md`、`contracts/static-site.md` 为准

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 初始化工程、依赖与工具链

- [X] T001 创建 `package.json`：`name: "speckit-web"`、`type: "module"`、`bin: { "speckit-web": "dist/cli.js" }`、`engines.node: ">=22"`、`files: ["dist"]`；脚本 `dev`、`build`（先 `vite build` 再 `tsup`）、`test`、`test:e2e`、`test:perf`、`lint`、`typecheck`；安装 plan.md Primary Dependencies 中列出的全部依赖及开发依赖 typescript、tsup、vite、@vitejs/plugin-react、vitest、@playwright/test、eslint、prettier；新增 `.nvmrc`（22）与 `pnpm-lock.yaml`
- [X] T002 [P] 创建 Node 侧 `tsconfig.json`（strict、`module: NodeNext`、include `src`）与前端 `web/tsconfig.json`（`jsx: react-jsx`、`lib: DOM`，通过 paths 允许引用 `src/core/model.ts` 与 `src/core/search.ts`）
- [X] T003 [P] 配置代码规范：`eslint.config.js`（typescript-eslint + react-hooks）、`.prettierrc`、`.editorconfig`
- [X] T004 [P] 创建 `vite.config.ts`：`root: "web"`、`base: "./"`、`build.outDir: "../dist/web"`、`worker.format: "es"`；开发时把 `/api` 代理到本地服务
- [X] T005 [P] 创建 `tsup.config.ts`：入口 `src/cli/index.ts` → `dist/cli.js`（ESM、带 `#!/usr/bin/env node`、target node22）
- [X] T006 [P] 创建 `vitest.config.ts`（unit/integration 两个 project，`tests/perf` 单独由 `test:perf` 运行）与 `playwright.config.ts`（Chromium，webServer 由各用例自行启动）
- [X] T007 [P] 创建 `.gitignore`（`node_modules/`、`dist/`、`speckit-site/`、`test-results/`、`playwright-report/`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事都依赖的核心解析、渲染、前端外壳、命令行骨架与夹具

**⚠️ CRITICAL**: 本阶段完成前不能开始任何用户故事

- [X] T008 在 `src/core/model.ts` 定义 data-model.md 中的全部类型：Project、Constitution、Feature、FeatureSummary、ArtifactSlot（kind 固定顺序 `spec` → `plan` → `research` → `data-model` → `contracts` → `quickstart` → `tasks` → `checklists`）、Document、DocumentRef、Task、TaskStats、ChecklistStats、SpecSummary、StageStatus（状态 `done` | `in_progress` | `not_started` | `optional_unknown`，含 `skipped`）、SearchIndexEntry、SearchHit、InitOptions、InitPlan、ChangeEvent，以及错误码联合类型（`NOT_SPECKIT_PROJECT`、`FORBIDDEN_HOST`、`BAD_TOKEN`、`FEATURE_NOT_FOUND`、`DOC_NOT_FOUND`、`EMPTY_QUERY`、`INVALID_OPTIONS`、`PREREQ_MISSING`、`SPECIFY_FAILED`、`PLAN_EXPIRED`、`CONFIRMATION_REQUIRED`、`APPLY_FAILED`）
- [X] T009 实现 `src/core/scan.ts`：以“根目录下必须存在 `.specify/` 目录才视为 Spec Kit 项目（`specs/` 可缺省）”判定项目；白名单扫描 `.specify/memory/constitution.md` 与 `specs/**` 下扩展名为 `.md/.yaml/.yml/.json/.graphql/.proto/.txt` 的文件；永远排除 `.git/`、`node_modules/`、`.env*`；对每个文件 `realpath` 后确认仍在项目根内，越界符号链接直接跳过；文档 ID 为“项目相对路径（统一 `/` 分隔）的 SHA-1 前 12 位”；输出 `Map<docId, {path, absPath, size, mtime, format}>` 注册表
- [X] T010 [P] 实现 `src/core/features.ts`：特性目录名匹配 `^(\d{3,})-(.+)$`（sequential）或 `^(\d{8}-\d{6})-(.+)$`（timestamp）；排序规则“先按前缀类型分组（顺序编号在前、时间戳在后），组内按前缀的数值/字典序升序；`unrecognizedDirs` 排最后”；生成 ArtifactSlot（缺失为 `missing`，`contracts`/`checklists` 为目录可含多份）与 extraDocs；读取 `.specify/feature.json` 得到 `currentFeatureId`，读取 `.specify/init-options.json`（`featureNumbering` 优先 `feature_numbering`、回退 `branch_numbering`、缺省 `sequential`；`integration` 回退 `ai`）
- [X] T011 [P] 实现 `src/core/markdown/ast.ts`：封装 remark-parse + remark-gfm 解析为 mdast；提供遍历带复选框列表项、提取标题文本、生成 CJK 安全的锚点 slug（github-slugger）等工具，供解析与渲染共用
- [X] T012 [P] 实现 `src/core/parse/constitution.ts`：`filled` = 不含 `[全大写_下划线]` 形式的模板占位符（如 `[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]`）；解析一级标题与 `**Version**: … | **Ratified**: … | **Last Amended**: …` 行得到 `version`/`ratified`/`lastAmended`（缺失为 null）
- [X] T013 实现 `src/core/render/index.ts` 渲染管线：remark-gfm → 标题锚点与 outline 收集 → remark-rehype → rehype-sanitize（白名单允许 `id`、`class`、`data-*`、Shiki 所需样式）→ @shikijs/rehype（浅/深双主题，语言限定 md/json/yaml/ts/js/bash/sh/powershell/python/diff/text 以控制体积）；` ```mermaid ` 代码块输出为 `<pre class="mermaid">` 原文供前端渲染；`yaml`/`json`/`text` 等非 Markdown 文档整体包成高亮代码块；文档 > 1 MB 时按 1 MB 分段，返回 `truncated: true, parts: n`
- [X] T014 [P] 实现 `src/core/render/links.ts`（unified 插件）：把指向已登记文档的相对链接改写为 `#/d/<docId>`（保留 `#锚点` 为 `?h=`）；指向未登记文件的链接改写为带 `data-unpublished` 的不可点击 `<span>`；外部链接加 `target="_blank" rel="noopener noreferrer"`
- [X] T015 实现 `src/core/project.ts`：`loadProject(root)` 组合 scan、features、constitution、render 产出 Project / Feature / Document；`tasks`、`checklists`、`stage`、`clarifications`、`specSummary` 字段先置为 null/空，由 US2 填充；提供按文档 ID 增量重建的 `refresh(paths)` 方法
- [X] T016 [P] 实现命令行文案 `src/i18n/index.ts`、`src/i18n/zh-CN.json`、`src/i18n/en.json`：按 `--lang`、`LC_ALL`、`LANG` 依次决定语言，`t(key, vars)` 支持插值
- [X] T017 [P] 实现前端文案 `web/src/i18n/index.ts`、`web/src/i18n/zh-CN.json`、`web/src/i18n/en.json`：默认取 `navigator.language`，手动切换写入 `localStorage`，提供 `useT()` hook
- [X] T018 [P] 实现主题 `web/src/styles/theme.css`（浅/深两套 CSS 变量，`prefers-color-scheme` 默认跟随）与 `web/src/theme.ts`（手动切换并写入 `localStorage`）
- [X] T019 定义 `web/src/data/source.ts`：`DataSource` 接口（`getProject()`、`getFeature(id)`、`getDoc(id, part?)`、`search(q, limit)`、`subscribe(onChange)`、`mode`），根据 `<meta name="speckit-web-mode">` 返回对应实现的工厂函数
- [X] T020 [P] 实现自定义下拉框 `web/src/components/Dropdown.tsx`（不使用原生 `<select>`）：面板配色跟随当前主题、当前项高亮打勾、↑/↓ 移动、Enter 选中、Esc 与点击外部关闭、可选搜索过滤、`role="listbox"` 无障碍属性
- [X] T021 实现前端外壳 `web/index.html`、`web/src/main.tsx`、`web/src/App.tsx`：wouter hash 路由 `#/`、`#/constitution`、`#/f/:featureId`、`#/f/:featureId/:artifact`、`#/d/:docId`、`#/search`、`#/init`；布局为左侧导航 + 内容区 + 顶栏（语言切换用 Dropdown、主题切换按钮）；全局错误边界
- [X] T022 实现命令行骨架 `src/cli/index.ts` 与 `src/cli/exit-codes.ts`：cac 注册 `serve [dir]`（默认命令）、`build [dir]`、`init [name]`、`--version`、`--help`、`--lang`；退出码常量 0/1/2/3/4/130 按 contracts/cli.md
- [X] T023 [P] 创建测试夹具 `tests/fixtures/`：`basic/`、`timestamp-numbering/`、`unfilled-constitution/`、`中文 空格/`、`not-speckit/`、`with-secrets/`（含 `.env`、`.git/`、源码文件）；每个夹具附 `expected.json` 记录人工清点的任务数、勾选数、检查清单数、待澄清数、阶段；`tests/fixtures/setup.ts` 在运行时生成越界符号链接与 > 1 MB 大文档（避免提交到 git）
- [X] T024 [P] 创建内置示例项目 `examples/demo-project/`：已填写的 `.specify/memory/constitution.md` 与 `.specify/init-options.json`、`.specify/feature.json`；`specs/001-*` 只有 spec.md；`specs/002-*` 除 research.md 外产物齐全，tasks.md 共 10 项任务已勾选 4 项（T005 未勾选）、任务描述引用 `FR-003`，spec.md 留 2 处 `[NEEDS CLARIFICATION: …]`，`checklists/requirements.md` 16/16 全部勾选，含表格、代码块与 Mermaid 图，含指向 `./plan.md` 的相对链接；`specs/003-*` 有带 `## Clarifications` / `### Session` 的 spec.md 与 plan.md；关键词“登录”恰好出现在两篇文档中
- [X] T025 [P] 编写 `tests/unit/scan.test.ts`：白名单与排除规则、越界符号链接被跳过、中文与空格路径、文档 ID 稳定性、非 Spec Kit 目录判定
- [X] T026 [P] 编写 `tests/unit/features.test.ts`：两种编号识别、排序规则、`unrecognizedDirs`、缺失产物为 `missing`、init-options 字段回退
- [X] T027 [P] 编写 `tests/unit/render.test.ts`：表格/代码/复选框/Mermaid 输出、`<script>` 与 `onerror=` 被净化、相对链接改写、未发布链接、超大文档分段

**Checkpoint**: 解析与渲染可用，前端外壳可启动，可以开始各用户故事

---

## Phase 3: User Story 1 - 在浏览器中浏览 Spec Kit 项目文档 (Priority: P1) 🎯 MVP

**Goal**: 本地模式一条命令浏览项目全部文档（实时刷新），并能导出为可部署到子路径的静态站点供同事在线查看

**Independent Test**: 用 `examples/demo-project` 执行 quickstart 场景 1、3、5：导航结构、渲染、目录大纲、相对链接、“未生成”、实时刷新、静态子路径访问均符合预期

### Tests for User Story 1

- [X] T028 [P] [US1] 编写 `tests/integration/security.test.ts`：`..`、URL 编码、符号链接越界及 `.env`/`.git` 文件均返回 `404 DOC_NOT_FOUND`；伪造 `Host` 返回 `403 FORBIDDEN_HOST`；浏览全过程项目目录文件哈希不变（SC-010）
- [X] T029 [P] [US1] 编写 `tests/integration/server.test.ts`：`/api/project`（含 `NOT_SPECKIT_PROJECT` 载荷 `{ status, name, canInit: true }`）、`/api/features/:id`（404 `FEATURE_NOT_FOUND`）、`/api/docs/:id`（含 `?part=`）、`Cache-Control: no-store`、首页注入 meta；端口被占用时自动递增
- [X] T030 [P] [US1] 编写 `tests/integration/build.test.ts`：输出目录结构符合 contracts/static-site.md；不含 `$HOME`/绝对路径/非白名单文件；两次构建除 `.speckit-web-build` 与 `generatedAt` 外逐字节一致；非 Spec Kit 项目退出码 3；无标记文件的已有输出目录拒绝清空
- [X] T031 [P] [US1] 编写 `tests/e2e/browse.spec.ts`：本地模式（场景 1、3：修改 tasks.md 后 2 秒内页面更新、删除当前文档出现提示）与静态模式（在 `/site/` 子路径托管，无任何 `/api/` 请求）

### Implementation for User Story 1 — 本地模式

- [X] T032 [P] [US1] 实现 `src/server/port.ts`：从 `5178`（或 `--port`）开始，被占用时递增尝试最多 20 个端口
- [X] T033 [US1] 实现 `src/server/app.ts`：Hono 应用只接受 `Host` 为 `localhost:<端口>`、`127.0.0.1:<端口>`、`[::1]:<端口>`，否则 `403 FORBIDDEN_HOST`；统一错误格式 `{ error, message }` 与 `Cache-Control: no-store`；实现 `GET /api/project`、`GET /api/features/:featureId`、`GET /api/docs/:docId`（只按注册表 ID 读取，未登记一律 `404 DOC_NOT_FOUND`）；托管 `dist/web` 并在首页注入 `<meta name="speckit-web-mode" content="local">` 与启动时随机生成的 `<meta name="speckit-web-token">`；支持运行时切换项目根目录（供 US3 使用）
- [X] T034 [US1] 实现 `src/server/watch.ts`：chokidar 监听 `.specify/memory/`、`.specify/*.json`、`specs/`，200 ms 去抖后调用 `project.refresh()` 并按 data-model §11 生成 `project`/`document`/`removed` 事件；在 `src/server/app.ts` 增加 `GET /api/events` SSE（`hello`、`change`、每 25 秒 `ping`）
- [X] T035 [US1] 实现 `src/cli/serve.ts` 并接入 `src/cli/index.ts`：`dir` 不存在或不是目录退出码 2；只绑定 `127.0.0.1`；输出“Spec Kit Web 已启动：http://localhost:<端口>/”，端口变化时提示“端口 5178 被占用，已改用 <端口>”；`--open`（默认）/`--no-open`
- [X] T036 [P] [US1] 实现 `web/src/data/local.ts`：`LocalSource` 调用 `/api/*`，`subscribe` 基于 EventSource（断线自动重连）
- [X] T037 [P] [US1] 实现 `web/src/hooks/useLiveData.ts`：收到 `project` 事件刷新导航与总览，`document` 事件命中当前文档时重新拉取，`removed` 命中当前文档时显示“该文档已被删除”
- [X] T038 [US1] 实现 `web/src/components/Sidebar.tsx`：“项目准则”入口、按排序列出特性及“当前”标记、每个特性下的标准产物（缺失显示“未生成”）与 extraDocs、末尾“未识别目录”分组
- [X] T039 [P] [US1] 实现 `web/src/components/Outline.tsx`：按 `outline` 渲染目录大纲、滚动时高亮当前章节、点击定位并把 `?h=<anchor>` 写入地址
- [X] T040 [P] [US1] 实现 `web/src/lib/mermaid.ts`：按需动态加载 mermaid，按当前主题渲染 `pre.mermaid`，主题切换时重绘
- [X] T041 [US1] 实现 `web/src/routes/DocView.tsx`：显示文档 `html`，根据 `?h=` 定位章节，拦截 `#/d/` 内部链接在应用内跳转，`data-unpublished` 悬停提示“该文件未发布”，`truncated` 时提供“加载下一段”，调用 mermaid 渲染
- [X] T042 [P] [US1] 实现 `web/src/routes/ConstitutionView.tsx`：显示准则正文及版本、批准日期、最后修订日期；`filled === false` 时显示“未填写”并提示运行 `/speckit-constitution`
- [X] T043 [P] [US1] 实现 `web/src/routes/FeatureView.tsx` 基础版：特性标题、标准产物列表及状态、extraDocs（进度区域由 US2 补充）
- [X] T044 [P] [US1] 实现 `web/src/routes/NotSpeckit.tsx`：显示“未检测到 Spec Kit 项目”，给出 `npx speckit-web init` 命令（US3 完成后改为向导入口）

### Implementation for User Story 1 — 静态发布

- [X] T045 [P] [US1] 实现 `web/src/data/static.ts`：`StaticSource` 以相对路径读取 `data/project.json`、`data/features/<encodeURIComponent(featureId)>.json`、`data/docs/<docId>.json` 与 `<docId>.part-<k>.json`；`subscribe` 为空操作；静态模式隐藏实时刷新指示与初始化入口
- [X] T046 [US1] 实现 `src/build/export.ts`：非 Spec Kit 项目退出码 3 并提示先运行 `speckit-web init`；`--out` 默认 `<dir>/speckit-site`，已存在时仅当含 `.speckit-web-build` 标记才清空，否则退出码 1；复制 `dist/web` 并把首页 meta 改为 `content="static"`；写入 `data/project.json`、`data/features/*.json`、`data/docs/*.json`（及分段文件）、`.nojekyll`、`.speckit-web-build`（版本与时间）；不写入绝对路径、主机名、用户名；JSON 键与数组顺序稳定以保证确定性；支持 `--title` 与 `--json`（输出 `{ out, features, documents, bytes, durationMs }`）
- [X] T047 [US1] 实现 `src/cli/build.ts` 并接入 `src/cli/index.ts`，成功后提示可使用 `examples/github-pages.yml` 发布
- [X] T048 [P] [US1] 创建 `examples/github-pages.yml`：在默认分支推送且 `specs/**` 或 `.specify/memory/**` 变化时执行 `npx speckit-web@<主版本> build . --out _site`，再用 `actions/upload-pages-artifact` 与 `actions/deploy-pages` 发布

**Checkpoint**: US1 可独立演示——本地浏览 + 静态发布均可用（MVP）

---

## Phase 4: User Story 2 - 一眼看清每个特性的推进进度 (Priority: P2)

**Goal**: 项目总览与特性页展示阶段、任务完成度（按阶段/用户故事）、检查清单通过情况与待澄清数量

**Independent Test**: 执行 quickstart 场景 2：示例项目中“只有规范”的特性阶段为“规范”，任务 4/10（40%），“待澄清 2 处”可逐一定位，16/16 清单显示“已全部通过”，“分析”显示“可选·无法自动判断”

### Tests for User Story 2

- [X] T049 [P] [US2] 编写 `tests/unit/counting.test.ts`：对 `tests/fixtures/` 全部夹具与 `examples/demo-project` 的任务、清单、待澄清计数与 `expected.json` 完全一致（SC-006），含代码块与 HTML 注释中的复选框不计入的用例
- [X] T050 [P] [US2] 编写 `tests/unit/stage.test.ts`：覆盖 data-model §8 阶段判定表的每一行，包括澄清/检查清单被跳过（`skipped: true`）、`analyze` 恒为 `optional_unknown`、`current` 的计算
- [X] T051 [P] [US2] 编写 `tests/e2e/progress.spec.ts`：quickstart 场景 2 的全部预期

### Implementation for User Story 2

- [X] T052 [P] [US2] 实现 `src/core/parse/tasks.ts`：解析 `- [ ] T001 [P] [US1] 描述` 行，所在 `## Phase N: 标题` 为其阶段；`done` 为 `[x]` 或 `[X]`；计数规则“只统计行首（允许缩进）为 `-`/`*`/`+` 后接 `[ ]`、`[x]`、`[X]` 的列表项；代码块、HTML 注释内的不计”；无 T 编号的复选框行也计入 `total`；输出 TaskStats 的 `byPhase` 与 `byStory`（无故事标签归入 `null`）
- [X] T053 [P] [US2] 实现 `src/core/parse/checklists.ts`：每份清单 `total`/`checked`（计数规则同任务），`allPassed` = `total > 0 && checked === total`
- [X] T054 [P] [US2] 实现 `src/core/parse/spec-summary.ts`：解析 `### User Story N - 标题 (Priority: Pn)` 得到 stories，`**FR-###**` 与 `**SC-###**` 条目得到 requirements / successCriteria；统计代码块与注释之外的 `[NEEDS CLARIFICATION` 标记（`clarifications.open`）以及 `## Clarifications` 下的 `### Session` 数（`clarifications.sessions`）
- [X] T055 [US2] 实现 `src/core/stage.ts`：严格按 data-model §8 判定表计算 8 个阶段状态；clarify、checklist 未执行但后续阶段已 done 时为 `not_started` + `skipped: true`；`implement` 在 `tasks.done === tasks.total > 0` 时为 `done`、`tasks.done > 0` 时为 `in_progress`；`current` = 按顺序最后一个 `done`/`in_progress` 的阶段（跳过 `optional_unknown`）
- [X] T056 [US2] 实现 `src/core/render/speckit-marks.ts`（unified 插件）：为任务行、检查项生成锚点；把待澄清标记包成 `<mark class="needs-clarification" id="nc-<序号>">`，写入 Document 的 `clarificationMarks`
- [X] T057 [US2] 在 `src/core/project.ts` 接入 tasks、checklists、spec-summary、stage 与 speckit-marks，填充 Feature 的 `tasks`、`checklists`、`clarifications`、`specSummary`、`stage` 与 FeatureSummary 精简字段
- [X] T058 [P] [US2] 实现 `web/src/components/StageBar.tsx`：按固定顺序显示 8 个阶段，区分完成 / 进行中 / 未开始 / 已跳过 / “可选·无法自动判断”
- [X] T059 [P] [US2] 实现 `web/src/components/ProgressBar.tsx`：显示 `done/total（百分比）`，可展开分组明细
- [X] T060 [US2] 实现 `web/src/routes/Overview.tsx`（路由 `#/`）：所有特性的列表，显示当前阶段、任务完成度、待澄清数量，点击进入特性页
- [X] T061 [US2] 扩展 `web/src/routes/FeatureView.tsx`：阶段条、用户故事（含优先级）与 FR/SC 摘要、任务完成度按阶段与按用户故事展开、检查清单列表（全部勾选显示“已全部通过”）、“待澄清 N 处”列表点击跳转到对应锚点

**Checkpoint**: US1 + US2 均可独立工作

---

## Phase 5: User Story 3 - 快速初始化一个新的 Spec Kit 项目 (Priority: P2)

**Goal**: 命令行与网页向导两种入口，委托官方 `specify` 完成初始化，覆盖前预览并确认，失败回滚

**Independent Test**: 执行 quickstart 场景 6、7：空目录命令行初始化、覆盖确认、前置条件缺失提示、`--dry-run`；网页向导初始化后自动切换到新项目视图

### Tests for User Story 3

- [X] T062 [P] [US3] 创建 `tests/fixtures/bin/specify`（及 Windows 用 `specify.cmd`）假可执行文件：支持 `version` 与 `init <dir> --integration --script --ignore-agent-tools`，写出固定的 `.specify/` 文件树，可通过环境变量模拟失败
- [X] T063 [P] [US3] 编写 `tests/integration/init.test.ts`：前置条件缺失退出码 4 且输出安装命令；空目录直接应用；非空/已有 `.specify/` 时 `requiresConfirmation` 为 true；`--dry-run --json` 不写入；复制中途失败后被覆盖文件被还原、新增文件被删除；暂存目录始终被清理；`--numbering timestamp` 改写 `feature_numbering`；非 TTY 缺少 `[name]`/`--here` 退出码 2、需确认但无 `--force` 退出码 1；取消退出码 130
- [X] T064 [P] [US3] 编写 `tests/integration/init-api.test.ts`：缺少或错误 `X-SpecKit-Web-Token` 返回 `403 BAD_TOKEN`；`400 INVALID_OPTIONS`（带 `fields`）、`412 PREREQ_MISSING`、`500 SPECIFY_FAILED`（带末尾 50 行 log）、`410 PLAN_EXPIRED`、`409 CONFIRMATION_REQUIRED`；新子目录成功后服务根目录切换并推送 `project` 事件
- [X] T065 [P] [US3] 编写 `tests/e2e/init-wizard.spec.ts`：用假 `specify`（通过 PATH）完成 quickstart 场景 7，验证下拉框键盘操作与 Esc 关闭

### Implementation for User Story 3

- [X] T066 [P] [US3] 实现 `src/init/runner.ts`：优先使用 PATH 上的 `specify`（解析 `specify version` 输出中的 `CLI Version`），否则若有 `uvx` 使用 `uvx --from git+https://github.com/github/spec-kit.git specify`；两者都没有时返回 `PREREQ_MISSING` 及按操作系统区分的 `installHint`（文案见 contracts/cli.md 的错误输出示例）
- [X] T067 [P] [US3] 创建 `scripts/sync-integrations.ts`：运行 `specify integration list` 解析表格，生成 `src/init/integrations.snapshot.json`（key、name、requiresCli），并提交当前快照（agy … zed，默认 `claude`）
- [X] T068 [US3] 实现 `src/init/integrations.ts`：加载快照，运行时若检测到本机 `specify` 再解析其 `integration list` 补充新增项；解析失败时静默回退到快照
- [X] T069 [US3] 实现 `src/init/options.ts` 校验与默认值：`target` 为 `{ kind: "here" }` 或 `{ kind: "new", name }`（CLI 默认 `new`、网页默认 `here`），“`name` 不得含路径分隔符、不得为 `.`/`..`、目标子目录不得已存在为文件”；`integration` “必须为已知 key 或用户手动输入的非空 key”，默认 `claude`；`script` 为 `"sh"` | `"ps"` | `"py"`，“Windows 为 `ps`，其余为 `sh`”；`featureNumbering` 为 `"sequential"` | `"timestamp"`，默认 `sequential`；错误按字段返回
- [X] T070 [US3] 实现 `src/init/plan.ts`：在系统临时目录执行 `specify init <tmp>/<name> --integration <key> --script <s> --ignore-agent-tools`（关闭标准输入确保非交互）；与目标目录逐文件比对得到 `create`/`overwrite`/`unchanged`；`targetState` 为 `"empty"` | `"non_empty"` | `"speckit_project"`；`requiresConfirmation` = “`targetState !== "empty"` 或存在 `overwrite`”；生成随机 `planId` 并在内存保存 10 分钟后过期清理；specify 失败时返回 `SPECIFY_FAILED` 与末尾 50 行输出
- [X] T071 [US3] 实现 `src/init/apply.ts`：按 data-model §10 状态流转执行——先把将被覆盖的文件备份到临时目录，再复制暂存文件；`featureNumbering` 为 `timestamp` 时改写目标 `.specify/init-options.json` 的 `feature_numbering`；复制出错进入 `rolling_back` 还原被覆盖文件并删除新增文件，无法回滚的列入 `leftovers`；无论结果都清理暂存与备份目录；成功时返回后续步骤指引
- [X] T072 [US3] 实现 `src/cli/prompts.ts` 与 `src/cli/init.ts` 并接入 `src/cli/index.ts`：参数 `[name]`、`--here`（与 `[name]` 互斥）、`--integration`、`--script`、`--numbering`、`--yes`（不自动确认覆盖）、`--force`（仍打印覆盖清单）、`--dry-run`、`--open`、`--json`；交互顺序“前置检查 → 目标目录 → AI 助手（可搜索列表）→ 脚本类型 → 编号方式 → 暂存生成 → 覆盖确认 → 应用 → 后续步骤”；非 TTY 自动非交互；退出码按 contracts/cli.md
- [X] T073 [US3] 实现 `src/server/init-routes.ts` 并挂载到 `src/server/app.ts`：`GET /api/init/options`、`POST /api/init/plan`、`POST /api/init/apply`、`POST /api/init/cancel`（`204`）；所有 POST 校验 `X-SpecKit-Web-Token`；目标只能是启动目录或其新建子目录；状态码与错误码按 contracts/data-api.md；新子目录成功后切换服务根目录、重启监听并推送 `project` 事件
- [X] T074 [P] [US3] 实现 `web/src/components/Dialog.tsx`：模态确认对话框（焦点锁定、Esc 关闭、主题配色）
- [X] T075 [US3] 实现 `web/src/routes/InitWizard.tsx`（仅本地模式，路由 `#/init`）：步骤为前置条件检查（缺失时显示安装命令）→ 目标目录（当前目录 / 新子目录）→ AI 助手（Dropdown 可搜索，含“其它（手动输入 key）”）→ 脚本类型 → 编号方式 → 预览文件清单（新增/覆盖/相同标签）→ 需要时 Dialog 二次确认 → 结果页（后续步骤 + “打开查看器”）；请求头带 meta 中的令牌
- [X] T076 [US3] 更新 `web/src/routes/NotSpeckit.tsx`：本地模式显示“初始化向导”按钮跳转 `#/init`，静态模式不显示

**Checkpoint**: US1～US3 均可独立工作

---

## Phase 6: User Story 4 - 在文档间搜索与交叉跳转 (Priority: P3)

**Goal**: 全项目全文搜索（中文准确命中、带上下文片段），`FR-###`/`SC-###`/`T###`/`CHK###` 编号可点击跳转

**Independent Test**: 执行 quickstart 场景 4：搜索“登录”命中示例项目中的两篇文档并高亮；在 tasks.md 点击 `FR-003` 跳到 spec 对应条目；`pnpm test:perf` 达标

### Tests for User Story 4

- [X] T077 [P] [US4] 编写 `tests/unit/search.test.ts`：中文子串命中、大小写与全角半角归一化、标题命中排在正文前、片段中除 `<mark>` 外内容已转义、`limit` 默认 50 最大 200
- [X] T078 [P] [US4] 编写 `tests/unit/xref.test.ts`：定义处生成锚点、同特性跨文档引用解析、代码块内编号不链接、引用不存在的编号保持纯文本
- [X] T079 [P] [US4] 编写 `tests/perf/generate.ts` 与 `tests/perf/perf.test.ts`：生成 50 特性 / 500 文档夹具，断言打开文档与搜索的 P95 ≤ 1 秒（`pnpm test:perf`，SC-003）
- [X] T080 [P] [US4] 编写 `tests/e2e/search.spec.ts`：本地与静态两种模式下的搜索与编号跳转

### Implementation for User Story 4

- [X] T081 [P] [US4] 实现 `src/core/search.ts`（不依赖 Node API，前后端共用）：从 mdast 提取去除标记的纯文本与标题偏移表构建 SearchIndexEntry；查询与文本做小写和全角→半角归一化后子串匹配；评分“标题命中 > 正文命中；同分按特性顺序”；片段为命中处前后各约 40 字，命中词用 `<mark>` 包裹且其余内容已转义；返回命中所在章节 `anchor`
- [X] T082 [US4] 实现 `src/core/render/xref.ts`（unified 插件）：为 `**FR-###**`、`**SC-###**` 条目以及 `T###`、`CHK###` 行生成定义锚点并写入 Document `anchors`；把正文中（代码之外）出现的编号包成链接，跳转到同一特性内定义所在文档的 `?h=<anchor>`；接入 `src/core/render/index.ts` 与 `src/core/project.ts`（需特性级编号表）
- [X] T083 [US4] 在 `src/server/app.ts` 增加 `GET /api/search?q=&limit=`（空查询 `400 EMPTY_QUERY`），索引驻留内存并随 `src/server/watch.ts` 的变更增量更新
- [X] T084 [US4] 在 `src/build/export.ts` 输出 `data/search.json`（SearchIndexEntry[]）
- [X] T085 [P] [US4] 实现 `web/src/workers/search.ts` 并在 `web/src/data/static.ts` 中实现 `search()`：首次搜索时懒加载 `data/search.json`，在 Worker 中调用 `src/core/search.ts` 的匹配函数
- [X] T086 [US4] 实现 `web/src/components/SearchBox.tsx`（顶栏，输入去抖 150 ms，`/` 快捷键聚焦）与 `web/src/routes/SearchView.tsx`（按特性分组显示结果与片段，点击跳转并以 `?q=` 让 `DocView` 高亮命中处）

**Checkpoint**: US1～US4 均可独立工作

---

## Phase 7: User Story 5 - 作为 GitHub 开源项目被复用和参与 (Priority: P3)

**Goal**: 仓库具备完整开源配套、自动化检查、自动发布与在线演示

**Independent Test**: 执行 quickstart 场景 9：配套文件齐全；PR 触发三平台 × 两个 Node 版本的 CI；未参与者仅凭 README 5 分钟内看到示例项目

### Implementation for User Story 5

- [X] T087 [P] [US5] 编写 `README.md`（英文）：一句话介绍、在线演示链接、`npx speckit-web` 快速开始、三条命令用法（链接 contracts 对应行为）、GitHub Pages 发布步骤、截图、贡献入口，顶部链接中文版
- [X] T088 [P] [US5] 编写 `README.zh-CN.md`（与英文版内容对应的中文版）
- [X] T089 [P] [US5] 添加 `LICENSE`（MIT，版权人与年份 2026）
- [X] T090 [P] [US5] 编写 `CONTRIBUTING.md`：开发环境（Node ≥ 22、pnpm）、常用脚本、目录结构说明、测试要求、Changesets 使用、提交与 PR 规范，以及维护者如何在仓库设置中开启 “Template repository”
- [X] T091 [P] [US5] 添加 `CODE_OF_CONDUCT.md`（Contributor Covenant 2.1）与 `SECURITY.md`（漏洞报告方式、本地服务的威胁模型：仅本机监听、Host 校验、令牌、白名单读取）
- [X] T092 [P] [US5] 创建 `.github/ISSUE_TEMPLATE/bug.yml`、`.github/ISSUE_TEMPLATE/feature.yml`、`.github/ISSUE_TEMPLATE/config.yml` 与 `.github/PULL_REQUEST_TEMPLATE.md`
- [X] T093 [P] [US5] 创建 `.github/workflows/ci.yml`：在 PR 与推送时于 Ubuntu/macOS/Windows × Node 22/24 运行 lint、typecheck、单元与集成测试、构建、Playwright 端到端测试，上传失败报告
- [X] T094 [P] [US5] 创建 `.changeset/config.json`、`CHANGELOG.md` 与 `.github/workflows/release.yml`：Changesets 生成版本 PR，合并后以 npm provenance 发布 `speckit-web`
- [X] T095 [P] [US5] 创建 `.github/workflows/pages.yml`：用本仓库构建的 `dist/cli.js build examples/demo-project` 发布在线演示到 GitHub Pages
- [X] T096 [P] [US5] 创建 `scripts/screenshots.ts`：用 Playwright 对示例项目生成浅/深色、中/英文截图到 `docs/screenshots/`，供 README 引用

**Checkpoint**: 全部用户故事完成

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事的质量收尾

- [X] T097 [P] 编写 `tests/unit/i18n.test.ts`：`src/i18n` 与 `web/src/i18n` 的中英文字典键完全一致、无空值
- [X] T098 [P] 在 `web/src/styles/layout.css` 补充窄屏适配：侧栏可折叠、表格横向滚动，保证移动端可阅读
- [X] T099 [P] 无障碍检查：导航、目录大纲、下拉框、对话框的键盘可达性与 aria 标签，在 `tests/e2e/a11y.spec.ts` 中用 @axe-core/playwright 断言无严重问题
- [X] T100 [P] 创建 `scripts/check-size.ts` 并加入 CI：`npm pack --dry-run` 统计安装体积，超过 15 MB 时失败
- [X] T101 在 `src/cli/serve.ts` 与 `src/server/watch.ts` 统一启动与运行时错误提示（端口全部被占用、监听失败、目录权限不足），文案中英文齐全
- [X] T102 按 `specs/001-speckit-web-scaffold/quickstart.md` 逐一执行场景 1～9 并记录结果，修复发现的问题

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成——阻塞所有用户故事
- **User Stories (Phase 3～7)**: 均依赖 Foundational 完成
  - 有人手时可并行；单人按优先级 P1 → P2 → P3 顺序
- **Polish (Phase 8)**: 依赖所需用户故事全部完成

### User Story Dependencies

- **US1 (P1)**: Foundational 完成后即可开始，不依赖其它故事
- **US2 (P2)**: Foundational 完成后即可开始；前端页面挂在 US1 的 `FeatureView.tsx` 上，若与 US1 并行，先完成 US1 的 FeatureView 基础版再扩展
- **US3 (P2)**: 命令行部分（runner/options/plan/apply/cli）只依赖 Foundational；网页向导与 `init-routes` 依赖 US1 的 `src/server/app.ts`
- **US4 (P3)**: `src/core/search.ts`、`xref.ts` 只依赖 Foundational；搜索接口与静态 `search.json` 分别依赖 US1 的 `app.ts` 与 `export.ts`
- **US5 (P3)**: 文档类任务随时可做；`pages.yml` 依赖 US1 的 `build`；README 截图依赖 US1、US2 的界面

### Within Each User Story

- 测试先写并确认失败，再实现
- core 解析/渲染 → server/build/init 接口 → 前端页面
- 每个故事在 Checkpoint 处独立验证后再进入下一个

### Parallel Opportunities

- Setup 中所有 [P] 任务可并行
- Foundational 中 features、ast、constitution、links、两套 i18n、主题、Dropdown、夹具、示例项目、单元测试可并行
- US2 的三个解析器、US3 的 runner 与快照脚本、US4 的 search 与 Worker、US5 的全部文档与工作流文件都可并行
- Foundational 完成后，US1 与 US3 命令行部分、US4 的 core 部分可由不同人同时推进

---

## Parallel Example: User Story 1

```bash
# 先并行写好 US1 的测试：
Task: "编写 tests/integration/security.test.ts"
Task: "编写 tests/integration/server.test.ts"
Task: "编写 tests/integration/build.test.ts"
Task: "编写 tests/e2e/browse.spec.ts"

# 再并行实现互不依赖的文件：
Task: "实现 src/server/port.ts"
Task: "实现 web/src/data/local.ts"
Task: "实现 web/src/data/static.ts"
Task: "实现 web/src/components/Outline.tsx"
Task: "实现 web/src/lib/mermaid.ts"
Task: "创建 examples/github-pages.yml"
```

## Parallel Example: User Story 2

```bash
Task: "实现 src/core/parse/tasks.ts"
Task: "实现 src/core/parse/checklists.ts"
Task: "实现 src/core/parse/spec-summary.ts"
Task: "实现 web/src/components/StageBar.tsx"
Task: "实现 web/src/components/ProgressBar.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "实现 src/init/runner.ts"
Task: "创建 scripts/sync-integrations.ts"
Task: "实现 web/src/components/Dialog.tsx"
Task: "创建 tests/fixtures/bin/specify 假可执行文件"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 Setup
2. 完成 Phase 2 Foundational（关键，阻塞所有故事）
3. 完成 Phase 3 US1：可先只做“本地模式”小节验证，再补“静态发布”小节
4. **停下验证**：执行 quickstart 场景 1、3、5
5. 可发布 0.1.0 预览版

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. + US1 → 验证 → 发布（MVP：本地浏览 + 静态发布）
3. + US2 → 验证 → 发布（进度总览）
4. + US3 → 验证 → 发布（初始化）
5. + US4 → 验证 → 发布（搜索与交叉跳转）
6. + US5 → 正式开源推广（README、CI、在线演示）；其中 LICENSE、CI 建议在首次公开仓库前就先完成
7. 每个增量都不破坏已有故事

### Parallel Team Strategy

1. 全员完成 Setup + Foundational
2. 之后：
   - 开发者 A：US1（服务端 + 静态导出）→ US4 的接口接入
   - 开发者 B：US2（解析器 + 进度页面）
   - 开发者 C：US3（初始化编排 + 向导）
   - 任何人：US5 文档与工作流
3. 各故事独立完成后集成

---

## Notes

- [P] 任务 = 不同文件、无未完成依赖
- [Story] 标签用于追溯到 spec.md 的用户故事
- 每个故事都应能独立完成与验证
- 先确认测试失败再实现
- 每完成一个任务或一组相关任务就提交一次
- 可在任何 Checkpoint 停下独立验证
- 避免：含糊的任务、同一文件冲突、破坏故事独立性的跨故事依赖

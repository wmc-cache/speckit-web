# Phase 9 验证记录

日期：2026-10-23～2026-10-24（Asia/Shanghai）。范围：T103～T114，以及 quickstart 场景 1～9。验证环境为 macOS arm64、Node 22.23.2 / 24.22.1、pnpm 10.34.5；浏览器使用 Playwright 1.64.1 已安装的完整 Chromium 1248（`PW_CHANNEL=chromium`，无界面运行）。

## 自动检查

| 检查 | 命令 | 结果 |
|---|---|---|
| 静态规范 | `pnpm lint` | 通过 |
| 类型 | `pnpm typecheck` | 通过 |
| Node 22 单元/集成 | `pnpm test` | 14 个文件、116 项通过 |
| Node 24 单元/集成 | `pnpm dlx node@24 node_modules/vitest/vitest.mjs run --project unit --project integration` | 14 个文件、116 项通过 |
| 性能 | `pnpm test:perf` | 50 特性 / 500 文档夹具的 3 项通过 |
| 构建 | `pnpm build` | Vite 6.4.5 与 tsup 构建成功 |
| 浏览器 | `PW_CHANNEL=chromium pnpm test:e2e` | 18 项通过；后续补充的无锚点分页搜索与中文错误校验另见下方最终复验 |
| 包体积 | `pnpm check-size` | 解压 5.34 MB，低于 15 MB；压缩 1.54 MB |
| 差异格式 | `git diff --check` | 通过 |

首次测试的端口监听、tsx IPC 与 npm 缓存访问受到沙箱限制，允许对应本地操作后已完成检查。缺失的 headless-shell 下载失败，改用同版本已安装的完整 Chromium 完成测试，无需系统浏览器配置变更。取消回归曾因全局临时目录中其他并发用例退出而误报，已改为检查本用例创建的目录；测试模块加载曾使用 Vitest 不支持的 import.meta.resolve，已改为 createRequire，Node 22/24 最终回归均通过。

## Quickstart 场景 1～9

| 场景 | 验证证据 | 结果与边界 |
|---|---|---|
| 1 本地浏览 | `tests/e2e/browse.spec.ts`、`tests/e2e/convergence.spec.ts` | 导航、产物、目录、表格、语法高亮、Mermaid、相对链接及产物快捷路由通过；未组织首次访问者计时实验 |
| 2 进度统计 | `tests/unit/counting.test.ts`、`stage.test.ts`、`tests/e2e/progress.spec.ts` | 示例 4/10、2 处澄清、16/16 清单、阶段及分组通过 |
| 3 实时刷新 | browse 与 convergence e2e | 2 秒内更新、删除提示、恢复文档、依赖链接新增、断线重连后正文更新通过 |
| 4 搜索与交叉跳转 | search e2e、convergence e2e、unit xref/search、perf | 本地/静态搜索与编号跳转、全半角高亮、查询更新/清空、后续分页定位通过；性能套件是本机测试，不是托管网络 SLA |
| 5 静态子路径 | build integration、browse/search/convergence e2e 的 static 分组 | `/site/` 子路径、无 API 请求、白名单、确定性、深链接通过；未部署 GitHub Pages，也未测远端排队/发布耗时 |
| 6 CLI 初始化 | init integration、convergence integration、真实 specify 验证 | 参数、预览、覆盖确认、过期预览、回滚、取消、前置条件提示通过；真实初始化详见下方 |
| 7 网页向导 | init-api integration、init-wizard e2e | 令牌、字段校验、目标路径边界、状态过期、新根切换、自定义下拉键盘及中文错误提示验证；浏览器初始化使用明确标识的 fake specify |
| 8 安全 | security/build/convergence integration | 外部路径、敏感文件别名、元数据链接、扫描后路径替换、只读哈希、Host/令牌、HTML 净化通过；使用合成内容而非真实敏感数据 |
| 9 开源工程 | README 中英版、许可证、贡献/行为/安全文档、Issue/PR 模板、CI/Pages/release 工作流检查与本地构建 | 配套文件具备，构建与本机测试通过；未修改远端设置、开启模板仓库、发布 npm、运行远端 CI 或验证 fork/首次访问者体验 |

## 真实官方初始化

使用本机 `specify 0.16.4`，通过 `detectRunner → createPlan → applyPlan → ProjectStore` 在系统临时目录生成全新子目录，选择 `claude`、`sh`、`timestamp`。预览包含 30 个文件；应用后项目状态 `OK`、编号 `timestamp`、特性数 0；`.specify/scripts/bash/check-prerequisites.sh` 与 `.claude/skills/` 存在。验证后删除临时项目。未运行 AI 助手中的 `/speckit-*` 交互命令；Windows PowerShell、Python 初始化及 uvx 首次联网回退未在本机实跑，不能将 fake specify 测试当作这些场景的真实验证。

## 修复与回归对应

- T103：`safe-read.ts` 同时检查入口及真实目标白名单；读取时再次校验并核对文件描述符身份。convergence integration 覆盖元数据、文档接口、搜索和静态导出。
- T104：名称先裁剪后校验；初始化目标及写入路径逐级拒绝符号链接。CLI/API 回归覆盖带空格的点路径及链接目标。
- T105：预览保存目标状态指纹，应用前核对；状态改变则拒绝写入，API 返回 `PLAN_EXPIRED`，用户须重新预览。
- T106：复制前登记可能新增的文件，失败后清理；回滚失败保留备份并报告其路径，目录清理失败如实列入 leftovers。注入部分复制、恢复失败及目录清理失败验证。
- T107：暂存阶段异常统一清理；CLI finally 清理确认取消后的计划；运行中的官方子进程支持 AbortSignal，POSIX 终止进程组，Windows 使用 taskkill /T。测试覆盖预取消、运行中 CLI SIGINT/130 和坏 JSON 清理；Windows 进程树终止仍需 Windows CI 实跑。
- T108：链接/定义依赖改变时使渲染缓存失效，刷新所有可能受影响文档；项目重连/恢复通知使正文重取。
- T109：整篇解析后按完整 HTML 块分段，保留全局目录、编号与 `anchorParts`，深链接及搜索按需加载后续段；大代码块允许超过分段目标大小以保持结构完整。
- T110：产物快捷路由支持单文档、目录列表、缺失产物及未知特性状态。
- T111：共享字段校验返回稳定 `init.error.*` 键，CLI/向导本地化；字段错误随语言切换重新取词，诊断日志保留原文。
- T112：高亮使用搜索共用归一化函数；每次查询先清理旧高亮，支持全半角与清空查询。
- T113：恢复计划选型 Vite 6、chokidar 4、wouter；见下方说明。
- T114：本记录对应场景 1～9，分别记录自动化、真实工具与远端未验证范围。

## 技术选型核实（T113）

读取已安装依赖元数据确认：原 chokidar 6 要求 Node >=22.22，Vite 8 要求 ^20.19 或 >=22.12；没有规范要求必须使用这些偏离计划的版本。故恢复 chokidar 4.0.3、Vite 6.4.5 和匹配的 React 插件 4.7.0，新增 wouter 3.13.0 的 useHashLocation 负责 hash 订阅。保留薄的 URL 编解码/查询参数适配层，以维持既有 `#/d/id?h=...&q=...` 格式；不调用会将查询串移到外层 URL 的 wouter navigate。Node 22/24 的后端回归及静态子路径浏览器用例用于验证兼容性。依赖锁文件同步更新，未盲目修改其他传递依赖版本。

## 最终复验

2026-10-24 完成最终复验：

- Node 22 / 24 完整单元集成均为 116/116；CLI 路径展示规范化的后续定向回归 24/24。
- Node 24 全浏览器回归中 17 项通过，新增向导测试因测试选择器误写“新子目录”（实际为“新建子目录”）超时；修正测试选择器后，对向导与 convergence 分组复跑 6/6 通过。无锚点后续分页搜索、中文错误提示和初始化完成均验证成功。
- 最终 `pnpm build`、`pnpm lint`、`pnpm typecheck`、`git diff --check` 通过。
- 未在 Windows/Linux 实跑，未推送、部署、发布或修改任何远端设置。

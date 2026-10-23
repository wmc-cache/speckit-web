# 快速验证指南: Spec Kit Web 文档查看与项目初始化开源脚手架

**特性**: [spec.md](./spec.md) | **方案**: [plan.md](./plan.md) | **契约**: [contracts/](./contracts/)

本文是端到端验证手册：按顺序执行每个场景并核对“预期结果”，全部通过即说明功能可用。实现细节见 tasks.md，这里只写怎么跑、看什么。

## 前置条件

- Node.js ≥ 22、pnpm ≥ 9、git
- 验证初始化场景时：已安装官方 `specify`（`specify version` 能输出版本），或已安装 `uv`（提供 `uvx`）
- 已克隆本仓库并在仓库根目录执行过：

```bash
pnpm install
pnpm build          # 预构建前端与命令行
```

---

## 场景 1：本地模式浏览内置示例项目（US1、SC-001、SC-002）

```bash
node dist/cli.js examples/demo-project
```

**预期结果**：

- 10 秒内终端输出 `http://localhost:5178/`（或自动换用的端口），浏览器自动打开。
- 左侧导航按顺序列出示例项目的全部特性，并有“项目准则”入口；当前特性带“当前”标记。
- 打开某特性的 spec：表格、代码块高亮、任务复选框、Mermaid 图正确显示；右侧有目录大纲，点击可定位；地址栏复制到新标签页能直达同一章节。
- 未生成的产物（如示例中故意缺失的 research）显示“未生成”。
- 文档里指向 `./plan.md` 的链接在查看器内跳转。

## 场景 2：进度总览与计数准确（US2、SC-006）

在场景 1 的页面打开“项目总览”。

**预期结果**：

- 示例项目中“只有规范”的特性显示当前阶段为“规范”；“完整产物”的特性显示任务 4/10（40%），并能按阶段、按用户故事展开。
- “待澄清 2 处”可点击逐一定位到高亮的标记。
- 全部勾选的检查清单显示“已全部通过”。
- “分析”阶段显示为“可选·无法自动判断”。
- 运行 `pnpm test -- counting`：解析器对 `tests/fixtures/` 全部夹具的计数与夹具中记录的人工清点结果一致。

## 场景 3：实时刷新（FR-011、SC-004）

保持场景 1 页面打开，在另一个终端：

```bash
sed -i.bak 's/- \[ \] T005/- [x] T005/' examples/demo-project/specs/002-*/tasks.md
```

**预期结果**：2 秒内页面上的任务完成度从 4/10 变为 5/10，无需手动刷新。验证后用 `.bak` 文件还原。删除当前打开的文档时，页面提示“该文档已被删除”。

## 场景 4：搜索与交叉跳转（US4、SC-003）

**预期结果**：

- 搜索框输入“登录”，列出所有命中文档与带高亮的上下文片段；点击跳转并高亮命中处。
- 在 tasks.md 中点击 `FR-003`，跳到同一特性 spec 的 FR-003 条目。
- 运行 `pnpm test:perf`：在生成的 50 特性 / 500 文档夹具上，打开文档与搜索的 P95 耗时均 ≤ 1 秒。

## 场景 5：静态构建与子路径部署（FR-009、FR-010、SC-005）

```bash
node dist/cli.js build examples/demo-project --out /tmp/site
npx serve /tmp --listen 4000        # 模拟子路径 /site/
```

打开 `http://localhost:4000/site/`。

**预期结果**：

- 页面、导航、总览、搜索、交叉跳转与本地模式一致；没有实时刷新指示，也没有初始化入口。
- 浏览器网络面板中没有任何 `/api/` 请求。
- `/tmp/site` 中不含 `.git`、`.env`、源代码或本机绝对路径：`grep -r "$HOME" /tmp/site` 无输出。
- 指向源码文件的链接显示为“该文件未发布”。
- 对同一输入再构建一次，`diff -r` 仅 `.speckit-web-build` 与 `generatedAt` 不同。

## 场景 6：命令行初始化（US3、FR-020～FR-026、SC-008）

```bash
cd "$(mktemp -d)"
node <仓库路径>/dist/cli.js init "我的 项目" --integration claude --script sh --numbering timestamp
```

**预期结果**：

- 2 分钟内完成，输出后续步骤指引。
- `我的 项目/.specify/init-options.json` 中 `integration` 为 `claude`、`feature_numbering` 为 `timestamp`。
- 与直接运行 `specify init ref --integration claude --script sh --ignore-agent-tools` 的结果相比，除 `init-options.json` 中的编号方式与 `here` 字段外文件集合和内容一致。
- 在已初始化的目录再运行 `... init --here`：先列出将覆盖的文件并要求确认；选择“否”退出码 130 且目录无变化。
- 把 PATH 中的 `specify`、`uvx` 暂时移除后运行：退出码 4，并给出当前系统的安装命令。
- `--dry-run --json` 只输出 InitPlan，目录无变化。

## 场景 7：网页向导初始化（US3、FR-020）

```bash
mkdir /tmp/empty-proj && node dist/cli.js /tmp/empty-proj
```

**预期结果**：页面显示“未检测到 Spec Kit 项目”与“初始化向导”按钮；按步骤选择（下拉为自定义面板，可键盘上下选择、Esc 关闭）后完成初始化，页面自动切换为该项目视图，显示“准则：未填写”和空的特性列表。

## 场景 8：安全（FR-007、FR-008、SC-010）

```bash
pnpm test -- security
```

**预期结果**：用例全部通过，覆盖：`..`/URL 编码/符号链接越界读取均返回 404；伪造 `Host` 头返回 403；不带令牌的 `POST /api/init/*` 返回 403；浏览与搜索全程项目目录的文件哈希不变；文档中的 `<script>`、`onerror=` 等被净化。

## 场景 9：开源仓库可用性（US5、FR-027～FR-029）

**预期结果**：

- 仓库根目录存在 README（中英）、LICENSE（MIT）、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、CHANGELOG、Issue 表单与 PR 模板。
- 新开一个 PR 时 CI 在 Ubuntu/macOS/Windows × Node 22/24 上运行 lint、类型检查、单元测试与端到端测试。
- 一位未参与开发的人只看 README，5 分钟内看到示例项目（可直接用 `npx speckit-web` 或在线演示）。

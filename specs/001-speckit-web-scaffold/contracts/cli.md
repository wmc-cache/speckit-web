# 命令行接口契约: `speckit-web`

**对应需求**: FR-009、FR-010、FR-020～FR-026、FR-030 | **数据模型**: [data-model.md](../data-model.md)

通用约定：

- 安装方式：`npx speckit-web <命令>`，或 `npm i -g speckit-web` 后直接使用 `speckit-web`。要求 Node.js ≥ 22。
- 输出语言按 `LANG` / `LC_ALL` 选择中文或英文；`--lang zh-CN|en` 可强制指定。
- 普通信息输出到 stdout，错误与警告输出到 stderr；`--json` 时 stdout 只输出一个 JSON 对象。
- 非 TTY（如 CI）时自动进入非交互模式。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 运行时错误（端口无法绑定、构建失败、初始化失败等） |
| 2 | 参数错误或非交互模式缺少必填项 |
| 3 | 目录不是 Spec Kit 项目（`serve` 不会返回此码，而是进入初始化引导页；`build` 返回此码） |
| 4 | 初始化前置条件缺失（未找到 `specify` 与 `uvx`） |
| 130 | 用户取消（Ctrl+C 或在确认步骤选择否） |

---

## `speckit-web [dir]` / `speckit-web serve [dir]`

本地模式启动查看器。`dir` 默认为当前目录。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--port <n>` | `5178` | 被占用时自动递增尝试最多 20 个端口 |
| `--open` / `--no-open` | `--open` | 是否自动打开浏览器 |
| `--lang <zh-CN\|en>` | 跟随系统 | 仅影响命令行输出 |

**行为**：

- 只绑定 `127.0.0.1`。启动成功输出：`Spec Kit Web 已启动：http://localhost:<实际端口>/`；若端口已变化，额外提示“端口 5178 被占用，已改用 <端口>”。
- 目录不是 Spec Kit 项目时仍然启动，网页显示“未检测到 Spec Kit 项目”并提供初始化向导入口。
- `dir` 不存在或不是目录：退出码 2。

## `speckit-web build [dir]`

静态发布模式：把 `dir` 的文档构建为静态站点。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--out <path>` | `<dir>/speckit-site` | 输出目录；存在时先清空（仅当其中含本工具生成的标记文件 `.speckit-web-build`，否则拒绝并退出码 1，防止误删） |
| `--title <text>` | 项目目录名 | 站点标题 |
| `--json` | 关闭 | 输出构建摘要 JSON：`{ out, features, documents, bytes, durationMs }` |

**行为**：

- 不是 Spec Kit 项目：退出码 3，提示先运行 `speckit-web init`。
- 输出只包含白名单文档的数据与前端资源（见 [static-site.md](./static-site.md)），资源路径均为相对路径，可部署在任意子路径下。
- 成功后提示可用 `examples/github-pages.yml` 发布到 GitHub Pages。

## `speckit-web init [name]`

初始化新的 Spec Kit 项目（委托官方 `specify` CLI，见 research R11）。

| 参数 | 默认值 | 说明 |
|---|---|---|
| `[name]` | 无（交互询问） | 新建子目录名；与 `--here` 互斥 |
| `--here` | 关闭 | 在当前目录初始化 |
| `--integration <key>` | `claude` | AI 助手 key；交互模式下以可搜索列表选择 |
| `--script <sh\|ps\|py>` | Windows 为 `ps`，其它为 `sh` | |
| `--numbering <sequential\|timestamp>` | `sequential` | |
| `--yes`, `-y` | 关闭 | 所有未给出的选项取默认值；**不会**自动确认覆盖 |
| `--force` | 关闭 | 目标非空或已是 Spec Kit 项目时跳过确认（仍会先打印覆盖清单） |
| `--dry-run` | 关闭 | 只输出将新增/覆盖的文件清单，不写入 |
| `--open` | 关闭 | 成功后立即以本地模式启动查看器 |
| `--json` | 关闭 | 输出 `InitPlan` 或结果 JSON（非交互） |

**交互流程**：前置检查 → 选择目标目录 → 选择 AI 助手 → 选择脚本类型 → 选择编号方式 → 暂存生成 → （需要时）展示覆盖清单并确认 → 应用 → 输出后续步骤：

```text
✔ 已在 ./my-project 初始化 Spec Kit 项目（specify 0.16.4，Claude Code，sh）
下一步：
  1. cd my-project
  2. 在 AI 助手中运行 /speckit-constitution 建立项目准则
  3. 运行 /speckit-specify <需求描述> 编写第一份规范
  4. 运行 npx speckit-web 查看文档
```

**错误输出示例**（退出码 4）：

```text
✖ 未找到 Spec Kit 命令行工具（specify），也未找到 uvx。
  请先安装 uv：
    macOS / Linux: curl -LsSf https://astral.sh/uv/install.sh | sh
    Windows:       powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
  然后安装 specify：
    uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

**非交互约束**：非 TTY 且未提供 `[name]`/`--here` 时退出码 2；需要确认覆盖但未给 `--force` 时退出码 1 并打印覆盖清单。

## `speckit-web --version` / `--help`

输出版本号 / 帮助（帮助文本随语言切换）。

# 数据模型: Spec Kit Web 文档查看与项目初始化开源脚手架

**特性**: [spec.md](./spec.md) | **方案**: [plan.md](./plan.md) | **日期**: 2026-10-23

本项目没有数据库，所有数据都是在运行时（本地模式）或构建时（静态模式）从项目文件解析得到的只读模型。下列类型同时也是本地接口与静态数据文件的载荷格式（见 [contracts/data-api.md](./contracts/data-api.md)）。

---

## 1. Project（Spec Kit 项目）

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 项目根目录名 |
| `mode` | `"local"` \| `"static"` | 数据来自本地服务还是静态文件 |
| `specKitVersion` | string \| null | 来自 `.specify/init-options.json` 的 `speckit_version` |
| `integration` | string \| null | AI 助手 key（`integration`，旧版本回退到 `ai`） |
| `script` | `"sh"` \| `"ps"` \| `"py"` \| null | 脚本类型 |
| `featureNumbering` | `"sequential"` \| `"timestamp"` | 优先 `feature_numbering`，回退 `branch_numbering`，缺省 `sequential` |
| `currentFeatureId` | string \| null | 来自 `.specify/feature.json` 的 `feature_directory` 对应的特性 |
| `constitution` | Constitution \| null | 文件不存在时为 null |
| `features` | FeatureSummary[] | 按排序规则排列 |
| `unrecognizedDirs` | string[] | `specs/` 下命名不符合规则的目录 |
| `generatedAt` | ISO 时间 | 数据生成时间 |

**校验规则**: 根目录下必须存在 `.specify/` 目录才视为 Spec Kit 项目（`specs/` 可缺省）；否则返回 `NOT_SPECKIT_PROJECT` 状态（本地模式引导初始化，静态构建报错退出）。

## 2. Constitution（准则）

| 字段 | 类型 | 说明 |
|---|---|---|
| `docId` | string | 对应 Document 的 ID |
| `filled` | boolean | 不含模板占位符（`[PROJECT_NAME]`、`[PRINCIPLE_1_NAME]` 等 `[全大写_下划线]` 形式）即为 true |
| `title` | string \| null | 一级标题 |
| `version` / `ratified` / `lastAmended` | string \| null | 解析 `**Version**: … \| **Ratified**: … \| **Last Amended**: …` 行 |

## 3. Feature（特性）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 目录名，如 `001-user-auth` |
| `prefix` | string | `001` 或 `20260319-143022` |
| `numberingKind` | `"sequential"` \| `"timestamp"` | 由前缀格式判断 |
| `shortName` | string | 前缀之后的部分 |
| `title` | string | spec.md 一级标题去掉 `Feature Specification:` 前缀；无 spec 时用 `shortName` |
| `artifacts` | ArtifactSlot[] | 固定顺序的标准产物位，见下 |
| `extraDocs` | DocumentRef[] | 特性目录内其它非标准文档 |
| `stage` | StageStatus | 见“阶段判定规则” |
| `tasks` | TaskStats \| null | tasks.md 不存在时为 null |
| `checklists` | ChecklistStats[] | 每份清单一项 |
| `clarifications` | `{ open: number, sessions: number }` | 剩余待澄清标记数、澄清会话数 |
| `specSummary` | SpecSummary \| null | 用户故事与编号摘要 |
| `updatedAt` | ISO 时间 | 目录内文档最晚修改时间 |

`FeatureSummary` 为 Feature 去掉 `specSummary` 与任务明细后的精简版，用于总览列表。

**排序规则**: 先按前缀类型分组（顺序编号在前、时间戳在后），组内按前缀的数值/字典序升序；`unrecognizedDirs` 排最后。

### ArtifactSlot（标准产物位）

固定顺序：`spec` → `plan` → `research` → `data-model` → `contracts` → `quickstart` → `tasks` → `checklists`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | 上述枚举 | |
| `status` | `"present"` \| `"missing"` | 缺失时界面显示“未生成”（FR-002） |
| `docs` | DocumentRef[] | `contracts`、`checklists` 为目录，可含多份；其它为 0 或 1 份 |

## 4. Document（文档）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 项目相对路径的 SHA-1 前 12 位（稳定、URL 安全，路径含中文与空格也无影响） |
| `path` | string | 项目相对路径，统一用 `/` 分隔 |
| `featureId` | string \| null | 准则为 null |
| `kind` | `"constitution"` \| ArtifactKind \| `"other"` | |
| `format` | `"markdown"` \| `"yaml"` \| `"json"` \| `"text"` | 非 Markdown 以代码块高亮显示 |
| `title` | string | 首个一级标题或文件名 |
| `html` | string | 已净化的渲染结果（仅完整 Document 包含） |
| `outline` | Heading[] | `{ depth, text, anchor }`，用于目录大纲（FR-005） |
| `anchors` | Record<string, string> | 编号 → 锚点，如 `FR-003 → fr-003`，用于交叉跳转（FR-019） |
| `clarificationMarks` | `{ anchor, text }[]` | 每处待澄清标记的位置（FR-015） |
| `size` | number | 源文件字节数 |
| `truncated` / `parts` / `part` | boolean / number / number | 整篇解析后的 HTML 按完整块分段，目标约 1 MB，单个块可超限；part 从 0 开始 |
| `anchorParts` | Record<string, number> | 全局锚点到分段编号的映射；每段保留整篇目录和编号索引 |
| `updatedAt` | ISO 时间 | |

`DocumentRef` = `{ id, path, title, kind, updatedAt }`。

**校验规则**: 只有通过白名单扫描（项目根内、扩展名允许、非排除目录、`realpath` 未越界）的文件才会成为 Document；接口只接受 Document ID，不接受路径。

## 5. Task 与 TaskStats（任务）

解析 tasks.md 中形如 `- [ ] T001 [P] [US1] 描述` 的行；所在的 `## Phase N: 标题` 为其阶段。

| Task 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `T001` |
| `done` | boolean | `[x]` 或 `[X]` 为 true |
| `parallel` | boolean | 含 `[P]` |
| `story` | string \| null | `[US1]` → `US1` |
| `phase` | `{ index, title }` | |
| `anchor` | string | |

| TaskStats 字段 | 说明 |
|---|---|
| `total` / `done` | 所有带复选框的任务行（含无 T 编号的行） |
| `byPhase` | `{ index, title, total, done }[]` |
| `byStory` | `{ story, total, done }[]`，无故事标签的归入 `null` |

**计数规则**（保证 SC-006 与人工清点一致）：只统计行首（允许缩进）为 `-`/`*`/`+` 后接 `[ ]`、`[x]`、`[X]` 的列表项；代码块、HTML 注释内的不计。

## 6. ChecklistStats（检查清单）

| 字段 | 说明 |
|---|---|
| `docId`、`name` | 清单文档与文件名（不含扩展名） |
| `total` / `checked` | 计数规则同任务 |
| `allPassed` | `total > 0 && checked === total`，界面显示“已全部通过” |

## 7. SpecSummary（规范摘要）

| 字段 | 说明 |
|---|---|
| `stories` | `{ index, title, priority: "P1"…, anchor }[]`，解析 `### User Story N - 标题 (Priority: Pn)` |
| `requirements` | `{ id: "FR-001", anchor, text }[]` |
| `successCriteria` | `{ id: "SC-001", anchor, text }[]` |

## 8. StageStatus 与阶段判定规则

阶段枚举（固定顺序）：`constitution`、`specify`、`clarify`、`plan`、`checklist`、`tasks`、`analyze`、`implement`。

每个阶段的状态：`done` | `in_progress` | `not_started` | `optional_unknown`。

| 阶段 | 判定为 `done` 的条件 | 说明 |
|---|---|---|
| constitution | `Constitution.filled === true` | 项目级，所有特性共享 |
| specify | 存在 spec.md | |
| clarify | spec.md 含 `## Clarifications` 且至少一个 `### Session` | 未执行时若后续阶段已 done，则显示为“已跳过”（`not_started` + `skipped: true`），因为澄清是可选的 |
| plan | 存在 plan.md | |
| checklist | `checklists/` 下存在 `requirements.md` 以外的清单 | 可选，规则同 clarify |
| tasks | 存在 tasks.md | |
| analyze | — | 始终为 `optional_unknown`（该步骤不产生文件） |
| implement | `tasks.done === tasks.total > 0` 为 `done`；`tasks.done > 0` 为 `in_progress` | |

`StageStatus.current` = 按顺序最后一个 `done` / `in_progress` 的阶段（跳过 `optional_unknown`）。

## 9. SearchIndex 与 SearchHit（搜索）

| SearchIndex 条目 | 说明 |
|---|---|
| `docId`、`featureId`、`title`、`path` | |
| `text` | 去除 Markdown 标记后的纯文本，已做小写与全角→半角归一化 |
| `headings` | `{ offset, anchor, text }[]`，用于把命中位置映射回最近的章节 |

| SearchHit 字段 | 说明 |
|---|---|
| `docId`、`featureId`、`title` | |
| `anchor` | 命中所在章节 |
| `snippet` | 命中处前后各约 40 字，命中词用 `<mark>` 包裹（已转义其余内容） |
| `score` | 标题命中 > 正文命中；同分按特性顺序 |

## 10. InitOptions、InitPlan 与 InitSession（初始化）

| InitOptions 字段 | 类型 | 默认值 | 校验 |
|---|---|---|---|
| `target` | `{ kind: "here" }` \| `{ kind: "new", name }` | CLI：`new`（需输入名称）；网页：`here` | `name` 不得含路径分隔符、不得为 `.`/`..`、目标子目录不得已存在为文件 |
| `integration` | string | `claude` | 必须为已知 key 或用户手动输入的非空 key |
| `script` | `"sh"` \| `"ps"` \| `"py"` | Windows 为 `ps`，其余为 `sh` | 枚举 |
| `featureNumbering` | `"sequential"` \| `"timestamp"` | `sequential` | 枚举 |

| InitPlan 字段 | 说明 |
|---|---|
| `planId` | 随机 ID，网页向导用它确认应用 |
| `runner` | `{ kind: "specify" \| "uvx", version }` |
| `targetPath` | 绝对路径（网页端只显示项目相对形式） |
| `targetState` | `"empty"` \| `"non_empty"` \| `"speckit_project"` |
| `files` | `{ path, action: "create" \| "overwrite" \| "unchanged" }[]` |
| `requiresConfirmation` | `targetState !== "empty"` 或存在 `overwrite` |

**InitSession 状态流转**:

```text
checking ──(前置条件缺失)──▶ failed(PREREQ_MISSING)
   │
   ▼
staging ──(specify 出错)──▶ failed(SPECIFY_FAILED)   [清理暂存目录]
   │
   ▼
planned ──(用户取消 / 超时 10 分钟)──▶ cancelled      [清理暂存目录]
   │ (确认；无需确认时自动进入)
   ▼
applying ──(复制出错)──▶ rolling_back ──▶ failed(APPLY_FAILED)   [还原被覆盖文件、删除新增文件]
   │
   ▼
succeeded  [清理暂存与备份；返回后续步骤指引]
```

## 11. ChangeEvent（本地模式变更事件）

| 字段 | 说明 |
|---|---|
| `type` | `"project"`（结构变化：增删特性/文档）\| `"document"`（单篇内容变化）\| `"removed"`（文档被删除） |
| `docIds` | 受影响的文档 ID |
| `at` | 时间 |

前端收到 `project` 刷新导航与总览；收到 `document` 且为当前文档时重新拉取；收到 `removed` 且为当前文档时提示“该文档已被删除”。

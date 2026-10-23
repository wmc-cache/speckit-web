# 本地数据接口契约（本地模式）

**对应需求**: FR-001～FR-026 | **类型定义**: [data-model.md](../data-model.md) | **静态等价物**: [static-site.md](./static-site.md)

本地模式下由 `speckit-web serve` 提供，地址 `http://localhost:<端口>`。前端通过 `DataSource` 接口访问数据：本地模式走以下接口，静态模式读取同结构的 JSON 文件，**两者载荷格式完全一致**。

## 通用约定

- 只接受 `Host` 为 `localhost:<端口>`、`127.0.0.1:<端口>`、`[::1]:<端口>` 的请求，否则 `403 { "error": "FORBIDDEN_HOST" }`。
- 所有响应为 `application/json; charset=utf-8`（SSE 除外），并带 `Cache-Control: no-store`。
- 错误格式：`{ "error": "<代码>", "message": "<已本地化的说明>" }`。
- 写操作（`POST /api/init/*`）必须带请求头 `X-SpecKit-Web-Token: <令牌>`，令牌在服务启动时随机生成，注入到首页 HTML 的 `<meta name="speckit-web-token">` 中；缺失或不匹配返回 `403 { "error": "BAD_TOKEN" }`。
- 不存在任何“按路径读取文件”的接口；文档只能按 Document ID 读取。

---

## GET `/api/project`

返回 `Project`（含 `features: FeatureSummary[]`）。

- 不是 Spec Kit 项目：`200 { "status": "NOT_SPECKIT_PROJECT", "name": "<目录名>", "canInit": true }`。
- 正常：`200 { "status": "OK", ...Project }`。

## GET `/api/features/:featureId`

返回完整 `Feature`（含 `specSummary`、`tasks` 明细与 `checklists`）。不存在：`404 { "error": "FEATURE_NOT_FOUND" }`。

## GET `/api/docs/:docId`

返回完整 `Document`（含 `html`、`outline`、`anchors`、`clarificationMarks`）。

- 未登记的 ID：`404 { "error": "DOC_NOT_FOUND" }`（包括所有越界、被排除的文件——不区分“不存在”与“不允许”，避免探测）。
- 大文档整篇解析后按完整 HTML 内容块分段，目标段大小约 1 MB（单个完整块可超过此值），避免截断代码围栏或重置锚点。`html` 为首段，并带 `"truncated": true, "parts": <n>`；`GET /api/docs/:docId?part=<k>` 获取后续分段。所有分段共享整篇 `outline`、`anchors`、`clarificationMarks`，`anchorParts` 将每个锚点映射到从 0 开始的分段编号，供深链接自动加载。

## GET `/api/search?q=<关键词>&limit=<n>`

返回 `{ query, hits: SearchHit[], total }`。`q` 去除首尾空白后为空：`400 { "error": "EMPTY_QUERY" }`。`limit` 默认 50、最大 200。

> 静态模式无此接口，前端在 Web Worker 中对 `data/search.json` 执行同样的匹配算法；匹配算法放在共享模块中，两边结果一致。

## GET `/api/events`

SSE 流。事件：

| event | data | 说明 |
|---|---|---|
| `hello` | `{ "version": "<speckit-web 版本>" }` | 连接建立 |
| `change` | `ChangeEvent` | 文件变化去抖 200 ms 后推送 |
| `ping` | `{}` | 每 25 秒心跳 |

## GET `/api/init/options`

返回初始化向导所需选项：

```json
{
  "runner": { "kind": "specify", "version": "0.16.4" },
  "prerequisites": [{ "name": "specify", "ok": true }, { "name": "uvx", "ok": true }],
  "integrations": [{ "key": "claude", "name": "Claude Code", "requiresCli": true }],
  "defaults": { "integration": "claude", "script": "sh", "featureNumbering": "sequential", "target": { "kind": "here" } },
  "targetState": "non_empty"
}
```

前置条件缺失时 `runner` 为 null，`prerequisites` 中带 `installHint`（按当前操作系统给出的安装命令）。

## POST `/api/init/plan`

请求体：`InitOptions`。执行暂存生成并比对，返回 `InitPlan`。

- 参数校验失败：`400 { "error": "INVALID_OPTIONS", "fields": { "<字段>": "<原因>" } }`。
- 前置条件缺失：`412 { "error": "PREREQ_MISSING" }`。
- `specify` 运行失败：`500 { "error": "SPECIFY_FAILED", "log": "<末尾 50 行输出>" }`。
- `target.kind === "new"` 时 `name` 只能是启动目录下的新子目录名。

## POST `/api/init/apply`

请求体：`{ "planId": "<id>", "confirmOverwrite": true|false }`。

- `planId` 不存在、已过期（10 分钟）或目标状态在预览后改变：`410 { "error": "PLAN_EXPIRED" }`。
- `requiresConfirmation` 为 true 而 `confirmOverwrite` 不为 true：`409 { "error": "CONFIRMATION_REQUIRED" }`。
- 成功：`200 { "status": "succeeded", "projectRoot": "<相对路径或 .>", "nextSteps": ["…"] }`；若目标为新子目录，服务把查看根目录切换到该子目录，并推送 `change`（`type: "project"`）。
- 应用失败并已回滚：`500 { "error": "APPLY_FAILED", "rolledBack": true, "leftovers": [] }`；若有无法回滚的文件，在 `leftovers` 中列出（FR-026）。

## POST `/api/init/cancel`

请求体：`{ "planId": "<id>" }`。删除暂存目录，返回 `204`。

## GET `/` 及静态资源

返回预构建前端；首页注入令牌 meta 与 `<meta name="speckit-web-mode" content="local">`。

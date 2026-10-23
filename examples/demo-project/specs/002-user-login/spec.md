# Feature Specification: 用户登录

**Feature Branch**: `002-user-login`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "支持邮箱密码登录和单点登录，登录失败要有清晰提示"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 邮箱密码登录 (Priority: P1)

已注册用户输入邮箱和密码即可登录，进入自己的工作台。

**Why this priority**: 没有登录，其它功能都无法使用。

**Independent Test**: 用测试账号完成一次登录并看到工作台。

**Acceptance Scenarios**:

1. **Given** 已注册用户，**When** 输入正确的邮箱和密码，**Then** 进入工作台。
2. **Given** 已注册用户，**When** 连续 5 次输错密码，**Then** 账号锁定 15 分钟并给出提示。

---

### User Story 2 - 企业单点登录 (Priority: P2)

企业成员通过公司身份提供商一键登录，无需单独设置密码。

**Acceptance Scenarios**:

1. **Given** 企业已配置身份提供商，**When** 成员点击“使用公司账号登录”，**Then** 跳转认证后返回工作台。

---

### User Story 3 - 记住我 (Priority: P3)

用户勾选“记住我”后，在同一设备上 30 天内无需再次输入密码。

### Edge Cases

- 身份提供商不可用时，提示用户改用邮箱密码。
- 会话在另一台设备被注销时，当前设备在下次请求时退出。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 支持邮箱与密码登录。
- **FR-002**: 系统 MUST 在连续 5 次失败后锁定账号 15 分钟。
- **FR-003**: 系统 MUST 对密码做加盐哈希存储，不得保存明文。
- **FR-004**: 系统 MUST 支持企业单点登录，协议为 [NEEDS CLARIFICATION: 需要支持 SAML、OIDC 还是两者？]
- **FR-005**: 系统 MUST 在“记住我”开启时保持会话 [NEEDS CLARIFICATION: 30 天是否符合企业客户的安全要求？]

### Key Entities

- **用户**: 邮箱、密码哈希、锁定截止时间。
- **会话**: 所属用户、设备、过期时间。

## Success Criteria *(mandatory)*

- **SC-001**: 95% 的用户在 10 秒内完成登录。
- **SC-002**: 登录失败提示的用户理解率达到 90%。

## Assumptions

- 详细的技术方案见 [实施方案](./plan.md)，任务拆解见 [任务清单](./tasks.md)。

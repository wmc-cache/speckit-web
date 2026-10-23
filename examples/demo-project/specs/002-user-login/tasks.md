# Tasks: 用户认证

**Input**: Design documents from `/specs/002-user-login/`

## Phase 1: Setup

- [x] T001 创建 `services/auth` 服务骨架
- [x] T002 [P] 配置数据库迁移工具

## Phase 2: Foundational

- [x] T003 创建 User 与 Session 表迁移 `services/auth/migrations/001_init.sql`
- [ ] T004 [P] 实现会话中间件 `services/auth/src/session.ts`

## Phase 3: User Story 1 - 邮箱密码认证 (Priority: P1)

- [x] T005 [US1] 实现 Argon2id 加盐哈希，满足 FR-003，文件 `services/auth/src/password.ts`
- [ ] T006 [US1] 实现 `POST /sessions` 接口 `services/auth/src/routes/sessions.ts`
- [ ] T007 [US1] 实现连续失败锁定（FR-002）`services/auth/src/lockout.ts`

## Phase 4: User Story 2 - 企业单点认证 (Priority: P2)

- [ ] T008 [US2] 接入身份提供商（依赖 FR-004 的澄清结果）`services/auth/src/sso.ts`

## Phase 5: User Story 3 - 记住我 (Priority: P3)

- [ ] T009 [US3] 实现长期会话 `services/auth/src/remember.ts`

## Phase 6: Polish

- [ ] T010 [P] 补充认证相关的端到端测试 `tests/e2e/auth.spec.ts`

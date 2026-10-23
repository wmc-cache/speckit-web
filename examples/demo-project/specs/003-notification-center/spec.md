# Feature Specification: 通知中心

**Feature Branch**: `003-notification-center`

**Created**: 2026-10-12

**Status**: Draft

## Clarifications

### Session 2026-10-14

- Q: 通知保留多久？ → A: 90 天，之后自动归档。
- Q: 是否需要邮件提醒？ → A: 仅对“被提及”类通知发送邮件。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 集中查看通知 (Priority: P1)

成员在一个地方看到所有提及、评论和审批通知。

### User Story 2 - 批量标记已读 (Priority: P2)

成员可以一键把所有通知标记为已读。

## Requirements *(mandatory)*

- **FR-001**: 系统 MUST 按时间倒序展示通知。
- **FR-002**: 系统 MUST 在 90 天后自动归档通知。
- **FR-003**: 系统 MUST 对“被提及”类通知发送邮件提醒。

## Success Criteria *(mandatory)*

- **SC-001**: 新通知在 5 秒内出现在通知中心。

# Feature Specification: 团队日历

**Feature Branch**: `001-team-calendar`

**Created**: 2026-10-02

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看团队本周安排 (Priority: P1)

成员打开日历即可看到本周所有人的会议与请假安排。

**Acceptance Scenarios**:

1. **Given** 团队有 5 名成员，**When** 打开日历，**Then** 按天显示每个人的安排。

### User Story 2 - 订阅到个人日历 (Priority: P2)

成员可以把团队日历订阅到自己常用的日历应用。

## Requirements *(mandatory)*

- **FR-001**: 系统 MUST 按周展示团队成员的安排。
- **FR-002**: 系统 MUST 提供可订阅的日历地址。

## Success Criteria *(mandatory)*

- **SC-001**: 成员在 3 秒内看到本周安排。

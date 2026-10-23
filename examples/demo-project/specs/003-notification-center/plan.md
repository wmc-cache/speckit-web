# Implementation Plan: 通知中心

## Summary

通知写入消息队列后由通知服务持久化，前端通过服务端推送实时接收。实现 [规范](./spec.md) 中的 FR-001～FR-003。

## Technical Context

- 存储：PostgreSQL，按月分区，90 天后归档到对象存储。
- 推送：Server-Sent Events。

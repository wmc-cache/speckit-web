# Data Model: 用户认证

## User

| 字段 | 类型 | 说明 |
|---|---|---|
| `email` | string | 唯一，小写存储 |
| `passwordHash` | string | Argon2id |
| `lockedUntil` | Date \| null | 失败次数过多时设置 |

## Session

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 随机 32 字节 |
| `userId` | string | |
| `expiresAt` | Date | 默认 12 小时；“记住我”见 FR-005 |

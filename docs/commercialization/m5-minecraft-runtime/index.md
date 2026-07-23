# M5 Minecraft 运行时

> 本页只定义 worker、服务器运行状态和 M4/M6/M9 共享的 runtime contract。具体实现见三个子页面。

## Shared contract

```ts
interface WorkerHeartbeat {
  serverId: string
  leaseId: string
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
  observedAt: string
}

interface RuntimeEvent {
  serverId: string
  leaseId: string
  type: 'started' | 'healthy' | 'stopped' | 'crashed'
  occurredAt: string
  details?: Record<string, unknown>
}

interface WorkerUsageEvent {
  eventId: string
  leaseId: string
  resource: 'server_time'
  quantity: number
  unit: 'second'
  sequence: number
  intervalStart: string
  intervalEnd: string
  occurredAt: string
  idempotencyKey: string
}
```

worker 使用实例级短期 token，不使用用户 OAuth session、Vultr 主 token 或 PayPal secret。M5 是每个 active lease 的 `server_time` 唯一生产者；`sequence` 对同一 lease 单调递增，结算区间不得重叠。M3 返回 `stop_required` 时，M5 立即停止 Minecraft 进程并向 M4 上报 stopped 事件；M4 负责最终关闭 lease。

## Shared API schema

```text
POST /v1/internal/servers/{serverId}/worker/register
POST /v1/internal/servers/{serverId}/worker/heartbeat
POST /v1/internal/servers/{serverId}/worker/events
POST /v1/internal/servers/{serverId}/worker/usage
POST /v1/internal/servers/{serverId}/worker/modpack/apply
POST /v1/internal/servers/{serverId}/worker/backup/export
POST /v1/internal/servers/{serverId}/worker/backup/restore
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `POST /v1/internal/servers/{serverId}/worker/register` | 注册 worker 并绑定短期 token/lease。 | worker session、lease |
| `POST /v1/internal/servers/{serverId}/worker/heartbeat` | 上报进程健康状态和资源观测。 | `200` 或 lease 错误 |
| `POST /v1/internal/servers/{serverId}/worker/events` | 上报启动、健康、停止和崩溃事件。 | 快速 `2xx` |
| `POST /v1/internal/servers/{serverId}/worker/usage` | 上报 `server_time` usage event。 | 去重结果 |
| `POST /v1/internal/servers/{serverId}/worker/modpack/apply` | 应用 M9 deployment manifest。 | apply 状态 |
| `POST /v1/internal/servers/{serverId}/worker/backup/export` | 执行用户手动发起的托管服务器世界导出。 | operation/task 状态 |
| `POST /v1/internal/servers/{serverId}/worker/backup/restore` | 恢复 M6 提供的世界内容。 | operation/task 状态 |

## Dependencies

M5 接收 M4 的 lease，消费 M9 的 deployment manifest，并为 M6 托管服务器世界备份提供手动导出/恢复能力。

## Shared contract consumption

M5 consumes `xmcl-web-api/contracts/shared/v1` without modifying it:

- D2 authorization is carried by the active M4 lease binding as
  `authorizationId`; M5 never decides balances or rates.
- D3 canonical usage is the exact `usage.recorded.v1` event. M5 maps an active
  lease to `sourceId`, supplies a strictly increasing per-lease `sequence`,
  and never overlaps intervals.
- D5 requires M5 to stop Minecraft after M3 returns `stop_required` and
  publish `runtime.stopped.v1` with `balance_exhausted`; M4 owns the 300-second
  force-stop escalation, lease closure, and `worker_unresponsive` reason.

D1/D4 storage accounting and D6 administrator commands are not M5 inputs or
outputs. M5 does not write storage accounting, balances, leases, or M4 server
state.

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

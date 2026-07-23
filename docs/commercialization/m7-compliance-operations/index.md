# M7 合规、风控与运营

> 本页只定义跨模块事件、审计和管理员操作 contract。具体实现见三个子页面。

## Shared contract

```ts
interface AuditEvent {
  eventId: string
  schemaVersion: number
  actor: { type: 'account' | 'admin' | 'worker' | 'system'; id: string }
  action: string
  resourceType: string
  resourceId: string
  correlationId: string
  causationId?: string
  occurredAt: string
  metadata?: Record<string, string | number | boolean>
}

interface AdminOperation {
  operationId: string
  action: 'refund' | 'balance_adjust' | 'server_suspend' | 'server_restore'
  target: { resourceType: string; resourceId: string }
  requestedBy: string
  reason: string
  ticketId?: string
  status: 'pending' | 'running' | 'resolved' | 'rejected'
}
```

所有退款、补偿、停服、恢复、权限调整、账户合并和 modpack 部署事件都必须可审计。

M7 只创建和追踪管理员操作，不直接写入 M1-M6、M8-M9 的业务资源。资源 owner 必须消费 `AdminOperation`，以自己的状态机执行命令并回写结果。审计 metadata 不得包含 OAuth/PayPal/worker token、完整支付信息或用户世界内容；保留期、访问角色和匿名化规则由 M7 版本化管理。

## Shared API schema

```text
GET  /v1/admin/audit-events
GET  /v1/admin/metrics
GET  /v1/admin/reconciliation
POST /v1/admin/accounts/{accountId}/refunds
POST /v1/admin/accounts/{accountId}/balance/adjust
POST /v1/admin/servers/{serverId}/suspend
POST /v1/admin/servers/{serverId}/restore
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `GET /v1/admin/audit-events` | 查询账户、支付、资源和管理员审计事件。 | 分页 `AuditEvent[]` |
| `GET /v1/admin/metrics` | 查询登录、支付、usage、服务器和队列指标。 | 指标快照 |
| `GET /v1/admin/reconciliation` | 查询 PayPal、账本、usage 和 Vultr 对账结果。 | 对账报告 |
| `POST /v1/admin/accounts/{accountId}/refunds` | 发起或记录退款。 | `taskId`、审计事件 |
| `POST /v1/admin/accounts/{accountId}/balance/adjust` | 有原因地补偿或扣回结算法币现金余额。 | ledger entry |
| `POST /v1/admin/servers/{serverId}/suspend` | 风控停服或冻结服务器。 | `taskId`、审计事件 |
| `POST /v1/admin/servers/{serverId}/restore` | 恢复被暂停服务器。 | `taskId`、审计事件 |

## Dependencies

M7 消费 M1-M6、M8-M9 的事件 contract；admin API 使用独立 scope、二次认证、原因和幂等键。

## Operations

- [商业化运营 Runbook](../operations-runbook.md)

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

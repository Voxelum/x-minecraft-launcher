# M4 Vultr 云服务器控制

> 本页只定义服务器控制平面、Vultr provider 和 M5/M9 共享的服务器 contract。具体实现见三个子页面。

## Shared contract

```ts
interface ServerResource {
  serverId: string
  accountId: string
  provider: 'vultr'
  region: 'taipei'
  status: 'creating' | 'stopped' | 'starting' | 'running' | 'stopping' | 'suspended' | 'billing_blocked' | 'failed' | 'deleting' | 'deleted'
  desiredStatus: 'running' | 'stopped' | 'deleted'
  statusVersion: number
  statusReason?: string
  providerResourceId?: string
  address?: string
  leaseId?: string
}

interface ServerLease {
  leaseId: string
  serverId: string
  startedAt: string
  endedAt?: string
  status: 'reserved' | 'active' | 'settled' | 'released'
}
```

M4 是 `ServerResource` 状态和 lease 的唯一写入者，所有 task 使用共享基础设施的 `AsyncTask`。只有 worker 健康后服务器才进入可计费的 `running`/active lease。服务器状态和 task 迁移必须幂等，且以 `statusVersion` 条件更新。M4 只读消费 `xmcl-web-api/contracts/shared/v1`：D1/D4 仍由 M2/M6 所有，D3 `server_time` 仍仅由 M5 产生。

允许的核心迁移为 `stopped -> starting -> running -> stopping -> stopped`，`creating -> stopped`，以及任意非终态到 `failed`/`deleting`。M7 的共享 `server_suspend` 命令将状态迁移为 `suspended`；M3 的 `stop_required` 先由 M5 停止 Minecraft 并发布共享 `runtime.stopped.v1`，M4 据此关闭 lease。300 秒内未观测到该事件时，M4 强制停止 provider 并记录 `worker_unresponsive`。`desiredStatus` 表达用户或管理员命令，不能由 worker 覆盖。

## Shared API schema

```text
GET    /v1/servers
POST   /v1/servers
GET    /v1/servers/{serverId}
POST   /v1/servers/{serverId}/start
POST   /v1/servers/{serverId}/stop
POST   /v1/servers/{serverId}/restart
DELETE /v1/servers/{serverId}
GET    /v1/tasks/{taskId}
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `GET /v1/servers` | 列出账户拥有的 Vultr Taipei 服务器。 | `ServerResource[]` |
| `POST /v1/servers` | 校验现金余额后创建服务器和 provisioning task。 | `202`、`taskId` |
| `GET /v1/servers/{serverId}` | 查询服务器状态、地址和 lease。 | `ServerResource` |
| `POST /v1/servers/{serverId}/start` | 异步启动服务器并等待 worker 健康。 | `202`、`taskId` |
| `POST /v1/servers/{serverId}/stop` | 异步停止服务器并结算 lease。 | `202`、`taskId` |
| `POST /v1/servers/{serverId}/restart` | 异步重启服务器。 | `202`、`taskId` |
| `DELETE /v1/servers/{serverId}` | 删除服务器资源。 | `202`、`taskId` |
| `GET /v1/tasks/{taskId}` | 查询异步操作进度和错误。 | `AsyncTask` |

## Dependencies

M4 输出 `serverId`、`taskId`、`leaseId` 和服务器状态；M4 在创建或启动前向 M3 申请运行授权、在停止或删除时释放授权，但不产生 `server_time` usage event。M5 使用 lease 并作为服务器用量唯一生产者，M9 使用 server ownership 和 deployment task。

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

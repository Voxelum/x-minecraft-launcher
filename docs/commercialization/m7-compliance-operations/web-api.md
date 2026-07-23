# M7 Web API 变更

## 边界

负责审计、风险事件、运营查询、对账、退款/补偿/停服操作和管理员权限。不替代业务模块执行账户、支付或服务器逻辑。

## 代码位置

- `xmcl-web-api/src/lib/audit.ts`
- `xmcl-web-api/src/lib/observability.ts`
- `xmcl-web-api/src/lib/reconciliation.ts`
- `xmcl-web-api/src/routes/operations.ts`
- `xmcl-web-api/cloudflare/worker.ts` 的 scheduled handler

## API

```text
GET  /v1/admin/audit-events
GET  /v1/admin/metrics
GET  /v1/admin/reconciliation
GET  /v1/admin/accounts/{accountId}
POST /v1/admin/accounts/{accountId}/refunds
POST /v1/admin/accounts/{accountId}/balance/adjust
POST /v1/admin/servers/{serverId}/suspend
POST /v1/admin/servers/{serverId}/restore
POST /v1/admin/operations/{operationId}/resolve
```

所有 admin API 使用独立 admin scope、MFA/二次认证、原因、ticket ID 和幂等键；所有操作写审计事件。scope 至少区分 `support`、`billing_operator`、`risk_operator` 和 `admin`，并按 action 校验。M7 创建 `AdminOperation` 后，将命令交给对应资源 owner：退款/现金余额调整由 M3，停服/恢复由 M4；M7 不直接覆盖余额、server 或 backup 状态。

## 验收

- 可查询支付、现金余额、usage、服务器、备份和 modpack 事件。
- 退款、补偿、停服和恢复都可追溯。
- 每个管理员命令都有授权角色、关联 ticket、资源 owner 的结果和不可包含敏感内容的审计 fixture。
- 对账失败和高风险事件能进入人工处理队列。

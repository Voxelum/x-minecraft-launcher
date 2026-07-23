# M5 Web API 变更

## 边界

接收 worker 注册、心跳、运行事件、usage、日志元数据和手动托管服务器世界导出/恢复事件。不运行 Minecraft 进程。

## 代码位置

- `xmcl-web-api/src/routes/worker.ts`
- `xmcl-web-api/src/lib/workerAuth.ts`
- `xmcl-web-api/src/lib/workerRepository.ts`
- `xmcl-web-api/src/routes/serverLogs.ts`

## API

```text
POST /v1/internal/servers/{serverId}/worker/register
POST /v1/internal/servers/{serverId}/worker/heartbeat
POST /v1/internal/servers/{serverId}/worker/events
POST /v1/internal/servers/{serverId}/worker/usage
POST /v1/internal/servers/{serverId}/worker/logs
POST /v1/internal/servers/{serverId}/worker/backup/export
POST /v1/internal/servers/{serverId}/worker/backup/restore
POST /v1/internal/servers/{serverId}/worker/backup/events
POST /v1/internal/servers/{serverId}/worker/modpack/prepare
POST /v1/internal/servers/{serverId}/worker/modpack/apply
POST /v1/internal/servers/{serverId}/worker/modpack/events
```

所有 worker API 使用实例级短期 token、server/lease 绑定、签名、时间戳和重放保护；不接受用户 OAuth session。

## 验收

- worker 事件可幂等接收和审计。
- 401/409 会使旧 worker token/lease 失效或重新注册。
- M4、M6、M9 的内部任务都能通过明确 operation ID 跟踪。

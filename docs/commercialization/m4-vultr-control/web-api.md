# M4 Web API 变更

## 边界

负责账户授权后的 Vultr instance 控制、服务器状态、task、lease 和 M9 部署任务协调。不运行 Minecraft，不解析 modpack。

## 代码位置

- `xmcl-web-api/src/routes/servers.ts`
- `xmcl-web-api/src/lib/serverControl.ts`
- `xmcl-web-api/src/lib/serverRepository.ts`
- `xmcl-web-api/src/lib/vultr.ts`

## Vultr v2 adapter contract

只有 `xmcl-web-api/src/lib/vultr.ts` 可以调用 Vultr API。adapter 使用 `https://api.vultr.com/v2` 和服务端 `VULTR_API_TOKEN` binding；客户端、官网、worker 和管理员页面都不得持有或调用该 token。XMCL 的 public API 不透传 Vultr response、provider resource ID 或 provider error body。

| XMCL 操作 | Vultr v2 API | adapter 行为 |
| --- | --- | --- |
| 启动时/创建前校验区域 | `GET /regions` | 解析已配置的 Taipei region ID；provider 不再提供该 region 时拒绝新的创建 task。 |
| 启动时/创建前校验规格 | `GET /plans` | 只接受 XMCL allowlist 中、在 Taipei 可用的 x86_64 plan。 |
| 创建实例 | `POST /instances` | 使用已验证的 region、plan、受控 Linux image 与 worker bootstrap user data；将 XMCL `serverId` 写入 provider label/tag，并持久化返回的 instance ID。 |
| provisioning/reconciliation | `GET /instances/{instance-id}` | 轮询 provider 实例状态、地址和规格；结果只驱动 M4 task/state，不能直接把服务器置为 `running`。 |
| 启动 | `POST /instances/{instance-id}/start` | provider 表示启动完成后仍等待 M5 worker healthy event。 |
| 优雅停止后的关机 | `POST /instances/{instance-id}/halt` | M4 先请求 worker 优雅停止；超时或 worker 不可达时再调用。 |
| 重启 | `POST /instances/{instance-id}/reboot` | 仅处理已存在实例；重启后等待新的 worker registration/healthy event。 |
| 删除 | `DELETE /instances/{instance-id}` | 仅在 M6 数据确认/备份 task 与 M4 lease 关闭后调用；保留 provider response 供 reconciliation。 |

Vultr 调用失败、超时或未知结果时，adapter 以已持久化的 instance ID 和 `GET /instances/{instance-id}` 做 reconciliation，不盲目再次 `POST /instances`。每个 XMCL task 仍以 M4 的 `Idempotency-Key` 和条件状态迁移去重；Vultr API 本身不是 XMCL 的幂等键来源。

## API consumer contract

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

所有改变资源的接口要求 `Idempotency-Key`，异步返回 `202`/`taskId`。M4 在创建或启动前向 M3 申请运行授权，只有 worker 健康后才建立 active lease；D5 的 `stop_required` 由 M3 返回给 M5，M5 发布 `runtime.stopped.v1` 后才由 M4 关闭 lease。若 300 秒内没有该事件，M4 强制停止 provider 并记录 `worker_unresponsive`。D6 只接受共享 `server_suspend`/`server_restore` 管理事件。M4 不发送 `server_time` usage event。

M4 是服务器状态的唯一写入者。状态更新必须携带 `statusVersion`，并记录原因、命令来源和关联 `taskId`；worker 只能上报观测，不能将 `suspended`、`billing_blocked` 或 `desiredStatus` 改回运行。

## 验收

- Vultr Taipei instance 生命周期可通过 API 幂等控制。
- provider 错误和 task 状态可查询。
- 并发启停、worker 失联、管理员停服和现金余额耗尽都有条件迁移 fixture。
- M4 不向客户端暴露 Vultr token。

# M6 手动世界备份

> 本页只定义两类世界来源、备份对象 schema 和 M5/M9/M3 共享 contract。具体实现见三个子页面。

## Shared contract

```ts
type BackupSourceType = 'client_world' | 'hosted_server_world'
type BackupFormat = 'linear' | 'layered_linear'

interface BackupResource {
  backupId: string
  accountId: string
  sourceType: BackupSourceType
  sourceId: string
  worldId: string
  format: BackupFormat
  formatVersion: number
  parentBackupId?: string
  status: 'creating' | 'uploading' | 'ready' | 'restoring' | 'failed' | 'deleted'
  sizeBytes?: number
  sha256?: string
}

interface BackupUploadGrant {
  backupId: string
  url: string
  expiresAt: string
  contentLength: number
  sha256: string
  requiredHeaders: Record<string, string>
}

interface StorageUsageEvent {
  accountId: string
  resource: 'storage_retention'
  quantity: number
  unit: 'byte_second'
  sourceId: string
  occurredAt: string
  idempotencyKey: string
}
```

## Backup format and object boundary

备份必须用户显式发起；不自动备份。备份对象不是原版 Minecraft 世界目录，也不是 live world 的原版 Anvil/`region/` 文件布局。客户端或 worker 先从原版世界目录创建临时 snapshot，再执行 XMCL 的压缩备份格式：

- `linear` 是完整世界 snapshot 生成的单个 Linear 压缩备份对象。
- `layered_linear` 是一个 Linear 压缩 base object 加上引用 `parentBackupId` 的 Linear 压缩 layer；restore 必须按父 layer 链解压重建。

对象存储和 signed URL 只接收上述压缩后的 Linear 对象，不保存原始世界目录。`formatVersion` 决定压缩/解压 decoder；`sizeBytes` 和 `sha256` 分别是压缩对象的长度与 hash，并且是 1 GiB 容量与超额保留计费的唯一依据。父 layer 被引用时不能删除。

创建备份前，M6 必须向 M4 验证 `hosted_server_world` 的 server ownership，或由 XMCL App 证明 `client_world` 是当前账户选择的世界。客户端/worker 必须先完成 Linear 压缩并声明压缩对象的 format、formatVersion、content length 和 sha256，M6 才能发放 signed URL。M6 必须读取 M2 的 `BackupStorageAllowance`：在 Account 的实际占用不超过 `1_073_741_824` byte 时，上传和保留不收费，也不请求 M3 授权。新上传会使实际占用超过 1 GiB 时，M6 在发放 signed URL 前向 M3 预留一个结算区间的超额保留费；余额不足时拒绝会增加超额容量的新上传，不删除已有备份。

signed URL 只授权一个 `backupId` 的压缩对象，并绑定 content length、sha256、必需 header 和过期时间；`complete` 由服务端验证对象存在、长度和 hash 后才允许从 `uploading` 进入 `ready`。M6 以 Account 当前实际占用减去 1 GiB 计算 `overageBytes`，只为该超额部分按固定结算区间产生 `storage_retention` 的 `byte_second` event。删除完成后停止对应超额保留计费；同一 layer 被多个备份引用时只计一次。所有 layer 删除必须以持久化引用计数检查，删除任务失败时保持原对象和 metadata 可恢复。

## Shared API schema

```text
GET    /v1/backup-sources/{sourceType}/{sourceId}/backups
POST   /v1/backup-sources/{sourceType}/{sourceId}/backups
GET    /v1/world-backups/{backupId}
POST   /v1/world-backups/{backupId}/upload-url
POST   /v1/world-backups/{backupId}/restore
DELETE /v1/world-backups/{backupId}
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `GET /v1/backup-sources/{sourceType}/{sourceId}/backups` | 查询客户端或托管服务器世界的备份链。 | `BackupResource[]` |
| `POST /v1/backup-sources/{sourceType}/{sourceId}/backups` | 用户显式创建手动备份任务。 | `202`、`backupId`、`taskId` |
| `GET /v1/world-backups/{backupId}` | 查询格式、父层、hash 和任务状态。 | `BackupResource` |
| `POST /v1/world-backups/{backupId}/upload-url` | 获取上传压缩对象的短期 signed URL。 | `BackupUploadGrant` |
| `POST /v1/world-backups/{backupId}/restore` | 用户显式恢复世界。 | `202`、`taskId` |
| `DELETE /v1/world-backups/{backupId}` | 删除备份或 layer，先检查父层引用。 | `202`、`taskId` |

## Dependencies

`client_world` 依赖 XMCL App 的世界 snapshot；`hosted_server_world` 依赖 M4/M5 的手动导出/恢复；M2 提供固定 1 GiB 免费容量；M3 负责超额保留时间的现金结算。

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

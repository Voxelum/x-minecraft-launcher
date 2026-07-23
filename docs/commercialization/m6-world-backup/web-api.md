# M6 Web API 变更

## 边界

负责客户端世界和 XMCL 托管服务器世界的手动备份、恢复、对象存储 metadata、signed URL 和 layer 生命周期。不做自动备份。

## 代码位置

- `xmcl-web-api/src/routes/worldBackups.ts`
- `xmcl-web-api/src/lib/worldBackupService.ts`
- `xmcl-web-api/src/lib/objectStorage.ts`
- `xmcl-web-api/src/routes/storageTasks.ts`

## API

```text
GET    /v1/backup-sources/{sourceType}/{sourceId}/backups
POST   /v1/backup-sources/{sourceType}/{sourceId}/backups
GET    /v1/world-backups/{backupId}
POST   /v1/world-backups/{backupId}/upload-url
POST   /v1/world-backups/{backupId}/complete
POST   /v1/world-backups/{backupId}/restore
DELETE /v1/world-backups/{backupId}
POST   /v1/internal/world-backups/{backupId}/events
```

`sourceType` 只能为 `client_world` 或 `hosted_server_world`；创建备份必须来自用户显式操作，且所有任务返回 `taskId`。

上传对象必须是 XMCL 生成的 `linear` 或 `layered_linear` 压缩备份，不接受原版世界目录、原始 Anvil/`region/` 文件或未压缩 ZIP。客户端/worker 先在本地或实例中从原版世界目录创建临时 snapshot，再压缩为声明的 format/formatVersion。`upload-url`、`complete` 和对象存储 hash 都针对压缩对象；`sizeBytes` 也只计算压缩后的对象大小。restore 按 formatVersion 解压并将世界恢复为 Minecraft 可读取的原版目录布局。

`upload-url` 前，M6 读取 M2 的 1 GiB 免费容量。上传后实际占用仍在 1 GiB 内时，不调用 M3，也不产生收费用量。上传会增加超额容量时，M6 先向 M3 预留一个超额保留结算区间；现金余额不足时拒绝该上传且不影响已有备份。`upload-url` 返回绑定 backup、内容长度、sha256、必需 header 和过期时间的单次 `BackupUploadGrant`。`complete` 必须在服务端验证对象 metadata 和 hash，验证成功前不得标记为 `ready` 或计算超额保留费。删除 layer 使用持久化引用计数；被引用的 parent 不可删除。

## 验收

- 不接受非托管服务器、日志、配置或任意文件。
- 不接受原版世界目录、原始 Anvil/`region/` 文件或未压缩 ZIP；只接受经验证的 `linear`/`layered_linear` 压缩对象。
- `linear`/`layered_linear` 父层引用安全可维护，restore 可按 formatVersion 还原原版世界目录布局。
- 1 GiB 内的备份不产生现金结算；仅超额 bytes 按保留时间产生 `storage_retention` fixture。
- 上传超时、hash/长度不匹配、无权 source、重复 complete 和 layer 删除冲突都有 fixture。
- signed URL、hash、来源归属和 layer chain 可验证。

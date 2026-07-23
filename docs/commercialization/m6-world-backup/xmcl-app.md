# M6 XMCL App 变更

## 边界

桌面端负责选择本地世界、从原版世界目录生成 `linear`/`layered_linear` XMCL 压缩备份对象、上传、恢复和显示备份链。托管服务器世界通过服务器管理页面显式触发；worker 也必须先压缩后上传。

## 代码位置

- `packages/instance/linear-backup.ts`
- `packages/instance/layered-linear-backup.ts`
- `xmcl-runtime-api/src/services/WorldBackupService.ts`
- `xmcl-keystone-ui/src/composables/worldBackups.ts`
- `xmcl-keystone-ui/src/views/` 下的备份页面

## API consumer

调用 M6 world-backups API 获取 signed URL、上传 Linear 压缩对象、确认完成和提交恢复任务，并调用 M2 查询 1 GiB 免费容量。客户端只临时读取原版世界目录以创建压缩对象，不上传原始目录或原始 Anvil 文件；恢复时将压缩对象解压回 Minecraft 可读取的世界目录。

## 验收

- 只能选择玩家世界目录。
- 用户明确点击后才开始备份。
- 上传前显示 `linear`/`layered_linear`、formatVersion、压缩后大小与 hash；不把原版世界目录或 ZIP 当成备份上传。
- 显示 1 GiB 免费容量、当前占用、超额容量和仅对超额保留时间收取的结算法币费用。
- 恢复前显示来源、格式、父层链和覆盖范围。

# M6 xmcl-page 变更

## 边界

官网展示手动备份服务、两种世界来源、linear/layered linear 格式、每个 Account 固定 1 GiB 免费容量、超额保留时间收费和恢复说明；不自动发起备份。

## 代码位置

- `xmcl-page/src/en/commercialization/backups.md`
- `xmcl-page/.vitepress/theme/components/commercialization/WorldBackups.vue`
- `xmcl-page/.vitepress/theme/components/commercialization/BackupRestoreDialog.vue`

## API consumer

如提供登录控制台，只调用 M6 的公开 backup API；对象存储只通过 API 返回的短期 signed URL 访问。

## 验收

- 页面明确不支持任意远程服务器备份。
- 页面明确备份为用户手动操作。
- 页面明确 1 GiB 内不收费，只有超额实际占用按保留时间以结算法币计费。
- 不把原始目录格式误称为备份格式。

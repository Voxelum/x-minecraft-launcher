# M2 XMCL App 变更

## 边界

桌面端可消费已发布的固定 1 GiB policy，但不计算或持久化实际占用。不展示套餐、订阅、积分或 AI/服务器免费额度。

## 当前 workspace 交付

- `xmcl-runtime-api/src/entities/backupStoragePolicy.ts` 提供只读 `BackupStoragePolicyV1` 和固定 v1 值。
- `xmcl-runtime-api/src/entities/backupStoragePolicy.test.ts` 锁定 policy 值、版本、不可变性和字段所有权。

本轮不新增 service、API client 或 renderer UI。M2 消费已发布的 `shared/v1/storage-accounting.schema.json#/$defs/policy` 和 session-authenticated `GET /v1/backup-storage-policy`；本增量只发布 runtime policy，未新增用户可见交互，因此不触发 UI 截图流程。

## 集成清单

- [x] 消费 `xmcl-web-api/contracts/shared/v1/storage-accounting.schema.json#/$defs/policy`。
- [ ] 通过已发布的 `GET /v1/backup-storage-policy` 增加只读 API client。
- [ ] API client 只反序列化 `freeBytes` 和 `policyVersion`。
- [ ] 若 M6 发布容量快照 API，由 M6 client model 单独承载 `usedBytes` 和 `overageBytes`。
- [ ] renderer 展示实际占用时遵循 `AGENTS.md` scratch spec 与截图流程。
- [ ] 客户端缓存不得授权上传、判断计费或更新 M6 状态。

## 验收

- runtime API 导出固定、不可变且版本化的 policy。
- policy 类型和值不包含 M6-owned 字段。
- 未发布 API 前没有虚构 endpoint 或用户可见 UI。

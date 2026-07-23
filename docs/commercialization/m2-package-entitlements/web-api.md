# M2 Web API 变更

## 边界

发布固定 1 GiB 免费备份容量 policy。没有 Account 状态、套餐、订阅、管理员权益授权或其他 quota API。

M2 只拥有：

- `freeBytes = 1_073_741_824`
- `policyVersion = 1`

M6 独占拥有 `usedBytes`、`overageBytes`、object/layer 引用和存储计费 cursor。M2 Web API 不读取或计算这些字段。

## 当前 workspace 交付

已发布 shared v1 的 [`storage-accounting.schema.json`](../../../../xmcl-web-api/contracts/shared/v1/storage-accounting.schema.json) 将 `BackupStoragePolicyV1` 定义为 `#/$defs/policy`。M2 消费该定义，并实现 shared OpenAPI 已定义的 session-authenticated `GET /v1/backup-storage-policy`；本轮不修改 shared contract：

- 版本化 schema 提案：[`proposals/backup-storage-policy.v1.schema.json`](proposals/backup-storage-policy.v1.schema.json)
- 成功 fixture：[`fixtures/backup-storage-policy.v1.json`](fixtures/backup-storage-policy.v1.json)
- 边界拒绝 fixture：[`fixtures/backup-storage-policy-with-m6-fields.invalid.json`](fixtures/backup-storage-policy-with-m6-fields.invalid.json)
- Server route：`xmcl-web-api/src/routes/backupStoragePolicy.ts`

## 集成清单

- [x] 消费 `xmcl-web-api/contracts/shared/v1/storage-accounting.schema.json#/$defs/policy`。
- [x] 以 shared v1 定义实现 session-authenticated `GET /v1/backup-storage-policy`。
- [ ] 若发布 HTTP route，补齐成功、权限不足和服务端错误 fixture。
- [ ] 读取操作不要求幂等键；M2 没有 provider，因此幂等重试和 provider 失败 fixture 不适用。
- [ ] Contract test 必须拒绝 `usedBytes`、`overageBytes`、object/layer refs 和 billing cursor。

## 验收

- policy 始终且只包含固定 1 GiB 和版本 1。
- M2 schema 不接受任何 M6-owned 字段。
- 未发布共享 contract 前不实现客户端或官网 API consumer。

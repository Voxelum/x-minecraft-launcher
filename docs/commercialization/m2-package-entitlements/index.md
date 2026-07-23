# M2 免费备份容量

> 本页只定义固定免费备份容量 policy。MVP 没有套餐、订阅、AI 免费额度、服务器免费额度或其他会员权益。

## D1 ownership

```ts
interface BackupStoragePolicyV1 {
  freeBytes: 1_073_741_824 // 1 GiB
  policyVersion: 1
}
```

M2 是 `BackupStoragePolicyV1` 的唯一 owner。M2 不按 Account 保存状态，也不拥有 `usedBytes`、`overageBytes`、object/layer 引用或存储计费 cursor。以上实际占用和计费输入全部由 M6 独占写入；M3 只结算 M6 产生的超额 `storage_retention` 用量。

免费容量不按月重置、不兑换现金，也不构成可转让的会员权益。AI 和云服务器不读取 M2，它们直接从 M3 的现金余额按价目表结算。

## Contract status

M2 消费已发布的 [`shared/v1/storage-accounting.schema.json`](../../../../xmcl-web-api/contracts/shared/v1/storage-accounting.schema.json) 中的 `#/$defs/policy`。该 shared v1 contract 是唯一权威来源；M2 的本地文件仅保留为兼容性投影和 fixture：

- [`proposals/backup-storage-policy.v1.schema.json`](proposals/backup-storage-policy.v1.schema.json)
- [`fixtures/backup-storage-policy.v1.json`](fixtures/backup-storage-policy.v1.json)
- [`fixtures/backup-storage-policy-with-m6-fields.invalid.json`](fixtures/backup-storage-policy-with-m6-fields.invalid.json)

已发布的 shared v1 OpenAPI 定义 session-authenticated `GET /v1/backup-storage-policy`。其只读响应只含 `freeBytes` 和 `policyVersion`；客户端和官网只能消费该已发布 route，不得聚合实际容量。

## Dependencies

M2 消费 `shared/v1` 的 D1/D4 存储边界，仅发布固定 policy 值。M6 是该 policy 的唯一业务消费者，并独立拥有 `StorageAccountingV1` 实际容量快照与聚合查询。

M2 不生产或消费 D2 authorization、D3 canonical usage、D5 300 秒 stop escalation 或 D6 admin events；这些边界不改变 M2 的固定 policy。

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

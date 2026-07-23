# M2 xmcl-page 变更

## 边界

官网只说明**每个 XMCL Account 固定 1 GiB** 的免费备份容量。官网不提供套餐、订阅或会员权益页面；该容量**不按月重置**，也**不是可转让、可兑换的会员权益**。M2 页面自身不计算实际占用、超额或费用。

## 当前 workspace 交付

`xmcl-page` 不在当前 workspace。本轮只冻结 M2-local 文案和精确实现清单，不创建不存在仓库的文件，也不假定 API client、组件或页面路径。文案消费已发布的 `shared/v1/storage-accounting.schema.json#/$defs/policy`。

建议文案必须同时表达：

- 每个 XMCL Account 的免费备份容量固定为 1 GiB（`1_073_741_824` bytes）。
- 免费容量不按月重置，也不是可转让、可兑换或可赎回的会员权益。
- `usedBytes`、`overageBytes`、object/layer 引用和 billing cursor 由 M6 服务端独占；超额保留费用由 M3 结算。
- 页面展示实际占用、超额或费用时，以 M6/M3 发布的服务端结果为准；M2 页面自身不计算这些字段。

## 集成清单

- [x] 消费 `xmcl-web-api/contracts/shared/v1/storage-accounting.schema.json#/$defs/policy`。
- [ ] 如需动态显示 policy，只调用已发布的 session-authenticated `GET /v1/backup-storage-policy`。
- [ ] 静态说明只读取或引用 `freeBytes` 和 `policyVersion`，并固定解释为 1 GiB/account。
- [ ] 登录页需要容量数据时，只消费 M6/M3 发布的服务端实际占用、超额和费用 contract。
- [ ] 不在页面、本地状态或 API client 中计算 `usedBytes`、`overageBytes`、object/layer refs 或 billing cursor。
- [ ] 不发明 endpoint、鉴权、错误码、套餐、订阅或会员模型。
- [ ] 实现后验证所有 locale，并执行 xmcl-page 自身的 build 与视觉检查。

## 验收

- 页面清楚说明每个账户固定 1 GiB 免费容量，且不是按月重置的额度。
- 页面清楚说明该容量不是可转让、可兑换或可赎回的会员权益。
- 页面只把 M6/M3 服务端发布结果当作实际占用、超额和费用的权威来源。
- 页面不声称 M2 计算 `usedBytes`、`overageBytes`、引用计数或 billing cursor。
- 不展示不存在的套餐、订阅或会员权益。

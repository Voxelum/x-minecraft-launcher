# M3 Web API 变更

## 边界

负责 PayPal 现金充值、账户现金余额、usage event 统一结算、退款和对账。M4/M5/M6/M8 不直接扣余额；不实现订阅、套餐或积分。

## 已消费的 shared contract

实现消费 `xmcl-web-api/contracts/shared/v1`：D2 使用
`UsageAuthorizationRequest` 的 `expectedQuantity` 与
`settlementIntervalSeconds`；D3 使用 `usage.recorded.v1`、`rateVersion`、
`intervalStart` 和 `intervalEnd`。D5 的 `stop_required` 只由 M3 返回，
M5/M4 分别拥有运行时停止和 300 秒强制停止。D6 只消费 `refund` 和
`balance_adjust`，以 `operationId` 去重并写一条 M3 completion。M3 不修改
该 shared contract。

## 代码位置

- `xmcl-web-api/src/routes/paypal.ts`
- `xmcl-web-api/src/routes/billing.ts`
- `xmcl-web-api/src/lib/paypal.ts`
- `xmcl-web-api/src/lib/billing.ts`
- `xmcl-web-api/src/lib/ledger.ts`
- `xmcl-web-api/src/lib/usageSettlement.ts`
- `xmcl-web-api/src/db.ts` 及 platform DB adapters

## API

```text
POST /v1/billing/paypal/orders
POST /v1/billing/paypal/orders/{orderId}/capture
GET  /v1/billing/orders
GET  /v1/billing/balance
GET  /v1/billing/rates
GET  /v1/billing/ledger
GET  /v1/billing/usage
POST /v1/webhooks/paypal
POST /v1/internal/usage/authorize
POST /v1/internal/usage/release
POST /v1/internal/usage/settle
POST /v1/internal/usage/reconcile
```

所有 webhook、现金充值和 usage settlement 都要验签/幂等。余额、预留、价目表和最终结算只由 M3 写入；资源模块先取得运行/用量授权，再提交使用 canonical unit 的 usage event。PayPal capture 成功后才增加已配置结算法币的现金余额，退款/拒付按已结算金额和 PayPal 结果记账。余额无法覆盖下一个结算区间时，结算结果必须返回 `stop_required`。

M3 只为 `server_time`、`ai_request`、`ai_tokens` 和超过 M2 1 GiB 免费容量的 `storage_retention` 定价。公开与客户端 API 返回已配置结算法币的现金金额，不得称为积分、点数或余额单位；内部持久化使用 `amountMinor` 以避免浮点误差。

## 验收

- PayPal 充值、现金余额和 usage event 可对账。
- 重复 webhook 不重复充值或增加余额。
- 预留、释放、余额耗尽和重复/乱序 usage event 都有 fixture。
- 服务器、AI 和超额备份保留时间统一使用现金 settlement contract。

# M3 XMCL App 变更

## 边界

桌面端提供 PayPal 现金充值、账户余额、订单、用量和结算明细；不保存 PayPal secret，不直接确认履约。所有面向用户的金额以已配置结算法币显示，不使用积分或点数。

## 代码位置

- `xmcl-runtime-api/src/services/BillingService.ts`
- `xmcl-keystone-ui/src/composables/billing.ts`
- `xmcl-keystone-ui/src/views/` 下的账单/钱包页面

## API consumer

调用 M3 的 billing、balance、rates、ledger、usage API。共享 usage 类型消费
`xmcl-web-api/contracts/shared/v1` 的 D2/D3 字段（包括
`expectedQuantity`、`settlementIntervalSeconds`、`rateVersion` 和
`intervalStart`/`intervalEnd`）；桌面端不产生权威结算。PayPal
approval/capture 结束后必须重新从服务端读取订单和余额状态。

## 验收

- 用户可用 PayPal 向账户充值现金余额。
- 可查看可用/预留现金余额、服务器与 AI 扣款，以及超出 1 GiB 后的备份保留费。
- 网络重试不会重复支付或重复增加余额。

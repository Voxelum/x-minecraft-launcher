# M3 xmcl-page 变更

## 边界

官网提供现金价目表、PayPal 充值入口和账户账单页面，不接收银行卡信息，不处理 webhook，不保存 PayPal secret。官网不提供订阅或套餐购买入口。

## 代码位置

- `xmcl-page/src/en/commercialization/billing.md` 及其他 locale
- `xmcl-page/.vitepress/theme/components/commercialization/PayPalCheckout.vue`
- `xmcl-page/.vitepress/theme/components/commercialization/BillingAccount.vue`

## API consumer

调用 M3 的 PayPal order、orders、balance、rates、ledger 和 usage API。页面将
`xmcl-web-api/contracts/shared/v1` 视为 D2/D3/D5/D6 的唯一 authority，
不复制或扩展其中字段；支付完成页面只展示服务端确认状态。

## 验收

- 价格以已配置结算法币显示，并与已发布的 rate version 一致。
- 支付取消、待确认、退款和争议状态可解释。
- 账号页面不暴露支付密钥或内部 webhook 信息。

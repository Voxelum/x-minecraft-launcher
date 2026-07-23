# M7 XMCL App 变更

## 边界

桌面端提供用户可见的订单争议、退款申请、账户删除、服务器申诉和错误反馈入口；不提供管理员操作。

## 代码位置

- `xmcl-runtime-api/src/services/SupportService.ts`
- `xmcl-keystone-ui/src/composables/support.ts`
- `xmcl-keystone-ui/src/views/` 下的账户/支持页面

## API consumer

调用受保护的用户支持/申诉 REST API。管理员 API 不得进入桌面客户端 bundle。

## 验收

- 用户可以提交并查看自己的工单。
- 敏感支付和 OAuth 信息不会被提交到普通客服内容。
- 退款、账户删除和服务器申诉显示明确状态。

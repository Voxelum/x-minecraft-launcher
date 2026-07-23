# M7 xmcl-page 变更

## 边界

官网提供隐私政策、服务条款、退款、自动续费、可接受使用、版权投诉和客服/申诉入口；管理员后台不放在公开官网页面。

## 代码位置

- `xmcl-page/src/en/privacy.md`
- `xmcl-page/src/en/terms.md`
- `xmcl-page/src/en/commercialization/acceptable-use.md`
- `xmcl-page/src/en/commercialization/support.md`
- `xmcl-page/.vitepress/theme/components/commercialization/SupportForm.vue`

## API consumer

调用 M7 的用户支持和申诉接口；公开页面不调用 admin scope API。

## 验收

- 所有收费、自动续费、退款、数据删除和服务器内容规则有公开页面。
- 表单不收集 PayPal secret、OAuth token 或不必要的支付信息。
- 多语言页面的政策版本一致。

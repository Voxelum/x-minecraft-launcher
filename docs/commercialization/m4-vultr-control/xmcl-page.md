# M4 xmcl-page 变更

## 边界

官网展示云服务器产品、Taipei 区域、资源规格、价格和登录后的服务器控制台。官网不直接调用 Vultr API。

## 代码位置

- `xmcl-page/src/en/commercialization/hosting.md` 及其他 locale
- `xmcl-page/.vitepress/theme/components/commercialization/ServerConsole.vue`
- `xmcl-page/.vitepress/theme/components/commercialization/ServerStatus.vue`

## API consumer

调用 M4 的公开 `/v1/servers` 和 task/usage API；Vultr token 只存在 `xmcl-web-api`。

## 验收

- 公开页面不承诺超出 MVP 的区域和规格。
- 登录控制台可显示创建、启动、停止和失败状态。
- 官网不把云服务器控制误认为本地服务器功能。

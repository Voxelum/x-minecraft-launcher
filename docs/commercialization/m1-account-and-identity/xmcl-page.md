# M1 xmcl-page 变更

## 边界

官网展示 Microsoft、Modrinth、Google、Discord OAuth 登录、绑定和账户合并流程，不建立第二套账户系统，也不保存 OAuth provider secret。官网没有启动器的游戏账户列表，因此只管理 XMCL Account 与其登录方式。

## 代码位置

- `xmcl-page/src/en/commercialization/account.md` 及其他 locale
- `xmcl-page/.vitepress/theme/lib/commercialApi.ts`
- `xmcl-page/.vitepress/theme/components/commercialization/AccountOAuth.vue`

## API consumer

调用 M1 Web API 的 `/v1/auth/*`、`/v1/account/*` 和 `/v1/sessions/*`。当前阶段只冻结页面和 API contract，交互控制台在 API 稳定后实现。

## 验收

- 官网说明无密码 OAuth 和四个 provider；Microsoft/Modrinth 登录可恢复与启动器相同的 XMCL Account。
- 不展示或记录 OAuth access/refresh token。
- 已有身份冲突时引导用户进入显式合并流程。

# M1 Web API 变更

## 边界

负责 XMCL Account、Microsoft/Modrinth/Google/Discord OAuth、session、身份绑定和账户合并的 serverless API。不负责 Minecraft 游戏 token、Modrinth token、支付、备份容量和服务器资源。

## 代码位置

- `xmcl-web-api/src/routes/account.ts`
- `xmcl-web-api/src/routes/session.ts`
- `xmcl-web-api/src/lib/account.ts`
- `xmcl-web-api/src/lib/accountMerge.ts`
- `xmcl-web-api/src/lib/oauth/microsoft.ts`
- `xmcl-web-api/src/lib/oauth/modrinth.ts`
- `xmcl-web-api/src/lib/oauth/google.ts`
- `xmcl-web-api/src/lib/oauth/discord.ts`
- `xmcl-web-api/src/middleware/xmclAuth.ts`

## API

```text
GET  /v1/auth/{provider}/authorize
POST /v1/auth/{provider}/exchange
POST /v1/auth/{provider}/launcher-exchange
GET  /v1/account
GET  /v1/account/identities
POST /v1/account/identities/{provider}/authorize
POST /v1/account/identities/{provider}/complete
DELETE /v1/account/identities/{provider}
POST /v1/account/merge/prepare
POST /v1/account/merge/confirm
POST /v1/sessions/refresh
POST /v1/sessions/revoke
POST /v1/account/deletion
POST /v1/account/deletion/cancel
```

`(provider, subject)` 唯一绑定；邮箱不触发自动合并。账户合并必须双重 OAuth 认证、显式确认、幂等执行并写入审计事件。

M1 自己发起的浏览器 `authorize`/`exchange` 使用 authorization code + PKCE，并绑定一次性 transaction、`state`、`nonce` 和 allowlisted redirect URI。`launcher-exchange` 验证启动器既有的 provider 登录流程，不强制 Microsoft 或 Modrinth 重走该浏览器流程。session 必须包含 `sessionId`、scope、签发/过期时间和 refresh-token family；refresh 重放撤销整个 family。解绑最后一个身份、删除已合并账户或取消窗口外的删除申请必须返回稳定错误码。

`launcher-exchange` 只接受启动器刚完成的 provider login transaction。M1 必须在服务端验证 provider 凭据、audience、issuer、过期时间和稳定 subject，随后立即丢弃原始凭据。Microsoft 验证使用启动器已获得且为 M1 配置的 OAuth scope/credential；Microsoft OAuth 身份验证完成后即可建立 XMCL identity，不依赖 Minecraft license、XSTS、Gamertag 或游戏启动。Modrinth 验证使用已登录用户的 provider API 身份。不能以 Minecraft profile、Gamertag、Modrinth display name 或邮箱推断 subject。响应的 `bindingDisposition` 只能是 `created`、`restored`、`linked`；身份已属于另一账户时返回 `409 identity_conflict`，仅可继续 `merge/prepare`。

Google 和 Discord 使用同一 PKCE transaction 机制；启动器在实现其本地 OAuth 登录前不得把它们标记为可用 provider。每个 provider 必须在 schema 中声明 issuer、client ID/audience、subject claim、允许 scope、回调 URI 和 credential 验证方式。

## 验收

- Microsoft、Modrinth、Google、Discord 均可创建或恢复 XMCL Account；首发启动器自动接入 Microsoft 和 Modrinth。
- Microsoft/Modrinth 的首次启动器登录会无额外注册页地创建或恢复 XMCL Account；不同 XMCL Account 的身份冲突绝不自动合并。
- 绑定已有账户时返回冲突，不自动迁移。
- 合并不会重复迁移现金余额、订单、服务器或备份。
- PKCE、state/nonce、redirect URI、launcher exchange、session rotation、解绑和删除申请都有成功、过期、重放和冲突 fixture。
- OAuth secret/token 不进入日志。

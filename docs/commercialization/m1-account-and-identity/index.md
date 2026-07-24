# M1 账户与身份

> 本页只定义 Web API、XMCL App 和 xmcl-page 共同依赖的账户 contract。具体实现见三个子页面。

## Shared contract

```ts
interface Account {
  accountId: string
  status: 'active' | 'merged' | 'deletion_pending' | 'deleted'
  createdAt: string
}

type OAuthProvider = 'microsoft' | 'modrinth' | 'google' | 'discord'

interface AccountIdentity {
  provider: OAuthProvider
  subject: string
  displayName?: string
  linkedBy: 'launcher_bootstrap' | 'launcher_link' | 'web_link'
  linkedAt: string
}

interface Session {
  sessionId: string
  accountId: string
  accessToken: string
  scopes: string[]
  issuedAt: string
  expiresAt: string
}
```

身份唯一键为 `(provider, subject)`。邮箱不作为主键，也不触发自动账户合并。账户合并必须二次认证、显式确认、幂等执行并可审计。

M1 自己发起的浏览器 `authorize`/`exchange` 使用 authorization code + PKCE：`authorize` 创建一次性 transaction，服务端绑定 provider、允许的 redirect URI、`state`、`nonce`、PKCE challenge 和过期时间；`exchange` 只接受对应 transaction 的回调。`launcher-exchange` 验证启动器既有的 provider 登录流程，不要求 Microsoft 或 Modrinth 重走浏览器授权。refresh token 按 session family 轮换，重放会撤销整个 family。注销和身份解绑都必须明确作用于指定 `sessionId` 或全部 session；不能解绑账户的最后一个身份。

## Launcher seamless sign-in

XMCL 不要求用户单独注册或设置密码。启动器已有的 Microsoft 游戏登录和 Modrinth 登录都是 M1 的首发身份入口：用户在启动器内成功登录任一 provider 后，客户端立即调用 `launcher-exchange`。M1 在服务端向对应 provider 验证本次凭据与稳定 subject，创建或恢复 XMCL Account，并签发自己的 `Session`。Microsoft 的 XMCL identity 在 Microsoft OAuth 身份已验证后即可建立，不依赖 Minecraft 所有权、Xbox profile 或游戏启动成功。provider token 只用于这次验证，不存入 M1、renderer、普通日志或审计 metadata；Minecraft/Xbox token 与 Modrinth token 不能作为 XMCL session 使用。

`launcher-exchange` 的结果必须按以下规则处理：

| 验证后的身份 | 当前 XMCL session | 结果 |
| --- | --- | --- |
| 已绑定同一 XMCL Account | 有或无 | 恢复该 Account 的 XMCL session。 |
| 未绑定 | 无 | 创建 XMCL Account，绑定该身份并签发 session。 |
| 未绑定 | 有 | 绑定到当前 Account；仅限用户刚主动完成的 provider 登录 transaction。 |
| 已绑定另一 XMCL Account | 有或无 | 返回 `identity_conflict` 和合并准备入口；不自动合并、不泄露另一账户资料。 |

启动器可以在已保存凭据刷新成功后静默恢复同一 XMCL session，但不得扫描或批量导入本地保存的多个 Microsoft/Modrinth 账户。每次新增身份必须来自用户刚完成的 OAuth 登录；同一设备、显示名或邮箱都不是自动绑定依据。Google 和 Discord 在启动器实现 OAuth 登录后遵循同一规则。

访客是未创建 XMCL Account 的本地使用者，不存在服务端 visitor identity。M1 仅提供本地数据迁移的确认 metadata，实际本地数据迁移由 XMCL App 负责。账户删除采用可取消的申请期；到期后由 M1 触发各资源 owner 的删除/匿名化任务，并保留 M7 所需的最小审计记录。

## Shared API schema

```text
GET  /v1/account
GET  /v1/account/identities
POST /v1/auth/{provider}/exchange
POST /v1/auth/{provider}/launcher-exchange
POST /v1/account/merge/prepare
POST /v1/account/merge/confirm
POST /v1/sessions/refresh
POST /v1/sessions/revoke
POST /v1/account/deletion
POST /v1/account/deletion/cancel
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `GET /v1/account` | 获取当前账户状态和基本信息。 | `Account` |
| `GET /v1/account/identities` | 查询已绑定的 OAuth 身份。 | `AccountIdentity[]` |
| `POST /v1/auth/{provider}/exchange` | 校验 OAuth 回调并创建或恢复 XMCL Account。 | `Session`、账户摘要 |
| `POST /v1/auth/{provider}/launcher-exchange` | 验证刚在启动器完成的 provider 登录，创建、恢复或绑定 XMCL Account。 | `Session`、`bindingDisposition` 或 `identity_conflict` |
| `POST /v1/account/merge/prepare` | 生成账户合并预览，不迁移资源。 | `mergeId`、资源摘要 |
| `POST /v1/account/merge/confirm` | 用户确认后异步执行幂等账户合并。 | `202`、`taskId` |
| `POST /v1/sessions/refresh` | 轮换短期 session。 | 新 `Session` |
| `POST /v1/sessions/revoke` | 撤销当前或设备 session。 | `204` |
| `POST /v1/account/deletion` | 创建可取消的账户删除申请。 | `202`、`taskId` |
| `POST /v1/account/deletion/cancel` | 在删除窗口内取消申请。 | `204` |

## Dependencies

其他模块只依赖 `accountId`、`Session` 和身份关联状态，不依赖 provider token、邮箱、Microsoft/Minecraft 游戏账号或 Modrinth token。

## Published shared-contract consumption

M1 consumes `xmcl-web-api/contracts/shared/v1` for the D1/D4
`GET /v1/backup-storage-policy` boundary: an XMCL session authenticates the
read-only fixed `1_073_741_824`-byte policy (`policyVersion: 1`). M1 does not
read, write, infer, or cache M6 `StorageAccountingV1`; only M6 owns
account-specific bytes, overage, references, and settlement cursors.

D2/D3 authorization and canonical usage, D5 stop escalation, and D6 admin
events are not M1-owned resources and are not direct M1 API consumers.
They continue to depend on M1 only for the opaque `accountId` and XMCL session
authentication boundary. The account/identity REST schema itself remains an
M1-local proposal until its separate versioned contract is published.

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

# M1 XMCL App 变更

## 边界

在桌面端提供无密码 OAuth 登录、自动 XMCL Account 建立/绑定、账户合并、session 刷新和退出。XMCL App 保留现有游戏账号系统登录 Minecraft，也保留现有 Modrinth 登录；两者成功后自动通过 M1 建立或恢复同一个 XMCL Account，但不把 provider token 当作商业账户 session。

## 代码位置

- `xmcl-runtime-api/src/services/CommercialAccountService.ts`
- `xmcl-runtime-api/src/entities/commercialAccount.ts`
- `xmcl-keystone-ui/src/composables/commercialAccount.ts`
- `xmcl-keystone-ui/src/windows/main/Context.ts`
- `xmcl-keystone-ui/src/components/UserAccountSwitcher.vue`
- `xmcl-keystone-ui/src/views/` 下的 Me/账户管理页面

## API consumer

调用 M1 Web API 的 `/v1/auth/*`、`/v1/account/*` 和 `/v1/sessions/*`。Microsoft OAuth 身份阶段成功后（不等待 Minecraft license、XSTS 或游戏启动）、Modrinth 登录成功及其本地凭据刷新成功后，`CommercialAccountService` 串行调用 `/v1/auth/{provider}/launcher-exchange`；同一 provider transaction 只能交换一次。OAuth 使用系统浏览器和一次性 transaction，不在客户端保存 provider secret。

Microsoft/Modrinth 身份未绑定时，无 XMCL session 则自动创建 Account；有当前 XMCL session 则绑定到它。已绑定另一 Account 时，停止自动流程，Me 页显示不泄露对方资料的冲突状态并进入显式合并。启动器不得扫描账户列表后批量绑定，也不得因为邮箱、昵称或同一设备合并。

## Me account-management view

Me 页必须将现有“游戏账户”与“XMCL Account”分开显示，避免用户把 Minecraft/Xbox 登录状态误认为 XMCL 账户、现金余额或备份容量状态：

- **游戏账户**：保留当前 Microsoft/Minecraft、离线账号和第三方皮肤站/认证站的切换、刷新与删除行为；不改变游戏启动的账户选择。
- **XMCL Account**：显示当前 Account 摘要、账户状态、已绑定登录方式、当前 session 状态、M3 现金余额和 M2 只读备份容量摘要；不显示 access token、refresh token、完整 subject 或邮箱。
- **登录方式**：显示 Microsoft、Modrinth、Google、Discord 的绑定状态与公开 display name。Microsoft/Modrinth 使用现有登录入口；Google/Discord 提供系统浏览器 OAuth 登录入口。用户完成任一新增 provider 登录后，成功时自动绑定当前 XMCL Account；冲突时只提供“查看并合并账户”操作。
- **安全操作**：提供刷新 XMCL session、退出当前设备、退出全部设备、移除非最后一个身份、账户删除申请和取消申请。移除身份不会删除本地 Minecraft 或 Modrinth 登录；移除本地游戏账户也不会解除 XMCL identity。

## 验收

- 访客可以继续使用本地功能。
- Microsoft 或 Modrinth 成功登录后，无额外注册页即可创建或恢复 XMCL Account；多次主动 provider 登录可自动绑定同一 Account。
- Google 和 Discord 在启动器内提供与 Microsoft/Modrinth 同级的 OAuth 登录入口，并使用相同的绑定/冲突流程。
- Me 页能分别管理游戏账户、XMCL 登录方式、session、现金余额与备份容量摘要，且不暴露 provider 或 XMCL token。
- 多个本地账户、身份冲突、移除本地账户、移除 XMCL identity 和网络失败均不导致错误合并或丢失游戏登录。
- session 过期、退出和网络失败可恢复。
- 现有 Microsoft Minecraft 登录回归不受影响。

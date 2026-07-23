# 产品范围与商业模式

## 商业目标

保持 XMCL 现有功能免费、本地优先和开放生态定位，仅对新增 AI、超额备份保留和云端服务器托管进行商业化验证。

## 现金余额与收费范围

用户通过 PayPal 向 XMCL Account 充值已配置结算法币的现金余额。账户、账单、价目表和客户端都直接显示法币金额，不引入积分、点数、包月套餐或其他会员权益。

- XMCL 托管的云服务器按实际运行时间从现金余额扣款。
- AI 请求和 token 用量按已发布的结算法币价目表从现金余额扣款。
- 每个 Account 有固定 1 GiB 免费备份容量；不按月重置。只有当前实际占用超过 1 GiB 的部分，才按超额 byte 的保留时间从现金余额扣款。

## 计时计费的适用范围

当前 XMCL 的专用服务器是用户本机上的进程。第一版不对本地服务器进程计时收费。服务器费用仅适用于 XMCL 托管的云端服务器，由服务端根据运行租约和实际状态从账户现金余额计费。

## MVP

- 云平台：Vultr。
- 区域：Taipei。
- 用户：台湾地区用户。
- 账户：无密码 OAuth，支持 Microsoft、Modrinth、Google 和 Discord；启动器内 Microsoft/Modrinth 登录自动创建或恢复 XMCL Account，支持身份绑定与显式账户合并。
- 支付：PayPal 充值结算法币现金余额；Payoneer 后续评估。
- 收费：AI 和 XMCL 托管服务器直接按结算法币价目表扣款。
- 备份：每个 Account 固定 1 GiB 免费容量；超额实际占用按保留时间收费。
- Modpack 部署：支持 mrpack 和 CurseForge export ZIP；上传包只允许 manifest、`config/**` 和 `data/**`，mod 必须来自 Modrinth 或 CurseForge。
- 架构：`xmcl-web-api` serverless API/控制平面 + Vultr 实例内 worker。
- 支持范围：经过验证的 x86_64 实例规格、Minecraft 版本/加载器和受控 modpack。

## MVP 用户闭环

1. 用户在启动器登录 Microsoft 或 Modrinth 时自动创建或恢复 XMCL Account；Google/Discord 登录同样可绑定或恢复该 Account。用户可通过 PayPal 充值结算法币现金余额。
2. 选择支持的 Minecraft 版本/模板和有限资源规格。
3. 创建 Vultr Taipei 云服务器。
4. 启动、停止、重启、查看状态和查看服务器日志；客户端世界和 XMCL 托管服务器世界备份均通过 M6 手动发起。
5. 用户上传 mrpack/CurseForge ZIP，M9 校验内容和 mod 来源并生成 deployment preview。
6. 用户确认后，M5 在 Vultr 服务器上应用 config/data 和已验证的 mods。
7. 服务器确认运行后产生 `server_time` usage event，系统按结算法币价目表从现金余额结算。
8. 停止后展示本次用量、费用和剩余余额。
9. 删除前执行备份/数据确认。

## 暂不支持

暂不做多区域调度、复杂网络拓扑、任意 Docker 镜像、开放端口市场、自动迁移和无限制 modpack 兼容。

## API contract 索引

本文件只定义产品边界，不重复定义业务接口。可执行接口分别位于：

- 账户和 OAuth：M1 `m1-account-and-identity/web-api.md` 的 REST API contract。
- 免费备份容量：M2 `m2-package-entitlements/web-api.md` 的 REST API contract。
- PayPal 充值、现金余额和统一 usage settlement：M3 `m3-paypal-settlement/web-api.md` 的 REST API contract。
- Vultr 服务器生命周期：M4 `m4-vultr-control/web-api.md` 的 REST API contract。
- Minecraft worker：M5 `m5-minecraft-runtime/web-api.md` 的 Worker API contract。
- 云存储、备份和恢复：M6 `m6-world-backup/web-api.md` 的 REST API contract。
- AI 请求和用量：M8 `m8-ai-service/web-api.md` 的 REST API contract。
- Modpack 导入和部署：M9 `m9-modpack-deployment/web-api.md` 的 REST API contract。
- 管理员、审计和运营：M7 `m7-compliance-operations/web-api.md` 的 REST API contract。

# 商业化运营 Runbook

本文面向上线、值守和人工处置人员。账户、结算、云服务器、世界备份、AI 和 Modpack 服务都必须使用平台注入的持久化 adapter；测试内存实现不得配置到生产环境。

## 上线前检查

1. 验证 XMCL session、管理员 MFA、worker 签名和内部 service scope 均由独立的生产 verifier 注入。
2. 验证账本/授权/结算、备份计费 cursor/outbox、部署任务和管理员操作使用条件更新或事务，并具有唯一幂等键。
3. 验证 PayPal webhook 使用原始 body 验签；PayPal、Vultr、对象存储和 AI provider 凭据仅来自平台 secret/binding，且不出现在日志、事件或客户端。
4. 启用服务器停止超时的 scheduled sweep。余额耗尽后，worker 先报告停止；超过 300 秒未报告时，控制平面必须强制停止 provider 实例并关闭 lease。
5. 为结算、备份 retention、worker usage、部署任务和管理员操作配置死信/人工处理队列及告警。

## 日常对账与告警

每天检查 `GET /v1/admin/reconciliation` 的 PayPal、现金账本、usage 和 Vultr 检查项。`mismatch` 或 `unavailable` 必须创建带 ticket ID 的人工处理项；不得直接修改余额、服务器状态或备份引用计数。

关键告警包括：

- PayPal webhook 验签失败、重复事件或 provider 未知结果。
- 使用量结算长期 pending、余额耗尽停止未完成、worker 心跳丢失。
- 备份对象校验失败、retention outbox 重试、引用计数冲突。
- Vultr 创建/停止未知结果、强制停止失败或 reconciliation 不一致。
- Modpack staging/hash 校验失败、回滚失败或 worker 事件乱序。

## 人工操作

仅使用独立管理员会话和最近 MFA 调用 `/v1/admin/*`。每次操作必须带原因、可选 ticket ID 和稳定的 `Idempotency-Key`；同一 `operationId` 的重试会返回原操作，不会再次派发。

- 退款和现金调整只路由到结算 owner。
- 停服和恢复只路由到服务器 owner。
- 查看审计事件时不得导出 OAuth、支付、worker credential 或世界内容。
- adapter 不可用时接口返回 `503`；恢复 adapter 后使用原 operation ID 重试，不要绕过 API 直接写数据库。

## 事故恢复

1. 先以 correlation/request/operation ID 查询审计事件、异步任务和 provider reconciliation 状态。
2. 对未知 provider 结果执行查询和 reconciliation，禁止盲目重复创建、扣款、上传或切换部署。
3. 对 provider 已成功而内部结算/事件尚未完成的请求，重试原幂等键，使 durable outbox 重放；不得重复调用 provider。
4. 对需要人工决策的失败保留资源和审计记录，记录 ticket 后通过管理员操作完成补偿、停服或恢复。

## 发布验收

发布前运行对应模块的 contract fixture、focused type check 和测试。任何新增 provider、结算规则、状态迁移或必填字段都必须先发布新的版本化 contract，不能修改已发布 v1 的语义。

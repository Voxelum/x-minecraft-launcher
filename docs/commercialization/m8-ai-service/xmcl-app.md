# M8 XMCL App 变更

## 边界

桌面端提供 AI 能力入口、模型选择、现金价格/余额提示、结果展示和错误状态；不保存 AI provider key，不直接扣现金。

## 已实现的 App 代码位置

- `xmcl-runtime-api/src/services/AiService.ts`
- `xmcl-keystone-ui/src/composables/ai.ts`
- `xmcl-keystone-ui/src/views/` 下的 AI 页面
- `xmcl-runtime/ai/AiApiClient.ts`
- `xmcl-keystone-ui/src/composables/ai.ts`

## API consumer

专用 `AiApiClient` 调用 `/v1/ai/models`、`/v1/ai/{capability}` 和 `/v1/ai/usage`，由注入的 M1 session
provider 提供 bearer credential。它不是 shared root API client，且不会调用 `/internal` endpoint。现金余额不足由
服务端返回稳定的 `insufficient_balance`。

`createAiClientState` 为每个 intent 生成一个幂等键，并只在 transport retry 时复用；usage 分页会按
`usageEventId` 去重，避免 retry/duplicate/out-of-order delivery 表示为另一笔 charge。renderer 只显示服务端
确认的费率/charge，不计算余额。真实 M1 credential accessor 与 AI view 在上游 schema 发布后再接入，避免将
session token 暴露给 renderer。

## 验收

- 用户可查看 AI 的现金价格、余额和实际扣款。
- 请求重试不会产生重复扣费。
- AI provider 错误不会显示内部 secret 或详细敏感请求。
- 当前无可接入的已发布 M1/M8 API 或 AI view，故没有 renderer-visible change；无需 scratch screenshot。接入 view
  时必须按 `AGENTS.md` 使用 scratch Playwright spec、test IDs 和 screenshots。

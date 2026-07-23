# M8 xmcl-page 变更

## 边界

官网展示 AI 能力、结算法币价目表和使用限制；如提供登录试用，仅调用 M8 REST API。

## 代码位置

- `xmcl-page/src/en/commercialization/ai.md`
- `xmcl-page/.vitepress/theme/components/commercialization/AiUsage.vue`
- `xmcl-page/.vitepress/theme/components/commercialization/AiTryout.vue`

## API consumer

调用 `/v1/ai/models`、`/v1/ai/{capability}` 和 `/v1/ai/usage`，不接触 provider key。

## 验收

- 页面清楚说明 AI 直接从账户现金余额按结算法币价目表扣款。
- AI 结果和错误状态有明确展示。

当前 workspace 不包含 `xmcl-page`。M8-local renderer handoff、状态 fixture 和可执行 fixture test 在
[`proposals/v1/xmcl-page-handoff.md`](proposals/v1/xmcl-page-handoff.md)。它定义 signed-out/loading/result/
recoverable-error、idempotent retry、provider failure、event retry/duplicate/out-of-order、余额不足和冲突的
可访问性与安全要求。实际组件只可在页面仓库及公开 M1/M8 client 发布后实现、类型检查和做响应式视觉验证。

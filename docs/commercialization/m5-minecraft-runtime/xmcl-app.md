# M5 XMCL App 变更

## 边界

桌面端展示云服务器连接信息、运行状态和日志入口；不直接连接 worker 内部 API，不把 worker token 暴露给用户。

## 代码位置

- `xmcl-runtime-api/src/services/CloudServerService.ts`
- `xmcl-keystone-ui/src/composables/cloudServers.ts`
- `xmcl-keystone-ui/src/views/` 下的服务器运行/日志页面
- 本地运行参考：`xmcl-runtime/launch/LaunchService.ts`

## API consumer

只调用 M4 的公开服务器状态/日志 API。worker heartbeat、usage、modpack apply 和 backup events 都由后端处理。

## 验收

- 用户看到的运行状态来自服务端而非本地窗口状态。
- 云服务器日志和客户端日志区分展示。
- worker token 不出现在 renderer 或普通日志。

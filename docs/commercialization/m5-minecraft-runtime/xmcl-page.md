# M5 xmcl-page 变更

## 边界

官网只展示服务器运行状态、连接方式、日志说明和故障处理文档，不直接调用 worker API。

## 代码位置

- `xmcl-page/src/en/commercialization/hosting.md`
- `xmcl-page/src/en/commercialization/server-guide.md`
- `xmcl-page/.vitepress/theme/components/commercialization/ServerRuntimeStatus.vue`

## API consumer

如官网提供登录控制台，只调用公开服务器状态和日志接口；内部 worker endpoint 永远不暴露给浏览器。

## 验收

- 文档明确云服务器运行与本地服务器的区别。
- 连接失败、启动中、运行中和故障状态有对应说明。

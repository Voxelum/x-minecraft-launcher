# M4 XMCL App 变更

## 边界

桌面端提供服务器创建、区域/规格选择、启停、状态、地址和用量入口。桌面端不直接调用 Vultr API，不运行云端 Minecraft 进程。

## 代码位置

- `xmcl-runtime-api/src/services/CloudServerService.ts`
- `xmcl-keystone-ui/src/composables/cloudServers.ts`
- `xmcl-keystone-ui/src/views/` 下的服务器管理页面
- 本地服务器参考：`xmcl-runtime/launch/LaunchService.ts`、`xmcl-keystone-ui/src/composables/instanceServerLaunch.ts`

## API consumer

调用 M4 的 `/v1/servers`、`/v1/tasks/{taskId}` 和 usage API。创建、启停、删除均展示异步 task 状态。

## 验收

- 账户可创建和管理自己的 Vultr Taipei 服务器。
- 配额、余额和权限错误有明确提示。
- server address 只在服务端确认实例安全后展示。

# M9 XMCL App 变更

## 边界

桌面端提供选择 mrpack/CurseForge ZIP、上传、validation report、deployment preview、apply 和 rollback；不在客户端信任 mod 来源或执行上传包内容。

## 代码位置

- `xmcl-runtime-api/src/services/ModpackDeploymentService.ts`
- `xmcl-keystone-ui/src/composables/modpackDeployment.ts`
- `xmcl-keystone-ui/src/views/` 下的 modpack 部署页面
- 现有 modpack 逻辑参考：`xmcl-runtime/modpack/ModpackService.ts`

## API consumer

调用 M9 import/deployment API；大包通过 signed URL 上传，apply 前必须让用户确认 validation report 和 preview。

## 验收

- UI 明确显示 config/data、mod 来源和拒绝项。
- 不把上传包中的 jar 当作可部署 mod。
- apply 失败时可回滚，不破坏旧部署。

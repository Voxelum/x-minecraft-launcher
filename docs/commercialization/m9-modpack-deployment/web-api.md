# M9 Web API 变更

## 边界

负责 mrpack/CurseForge ZIP 导入、结构化解析、安全校验、Modrinth/CurseForge 来源解析、validation report、deployment manifest、preview/apply/rollback 任务。

## 代码位置

- `xmcl-web-api/src/routes/modpackDeployments.ts`
- `xmcl-web-api/src/lib/modpackImport.ts`
- `xmcl-web-api/src/lib/modpackValidator.ts`
- `xmcl-web-api/src/lib/modpackSources/modrinth.ts`
- `xmcl-web-api/src/lib/modpackSources/curseforge.ts`
- `xmcl-web-api/src/lib/deploymentManifest.ts`
- `xmcl-web-api/src/lib/deploymentTasks.ts`

## API

```text
POST /v1/servers/{serverId}/modpack-imports
POST /v1/modpack-imports/{importId}/upload-url
POST /v1/modpack-imports/{importId}/complete
GET  /v1/modpack-imports/{importId}
GET  /v1/modpack-imports/{importId}/validation
POST /v1/servers/{serverId}/modpack-deployments
GET  /v1/servers/{serverId}/modpack-deployments
GET  /v1/modpack-deployments/{deploymentId}
POST /v1/modpack-deployments/{deploymentId}/preview
POST /v1/modpack-deployments/{deploymentId}/apply
POST /v1/modpack-deployments/{deploymentId}/rollback
```

校验只允许 manifest、`config/**` 和 `data/**`；mod 必须通过 provider project/file ID 下载。发现 jar、exe、任意 URL、非法路径、符号链接、路径穿越、重复路径、超过 ZIP 限制或未解析来源时，整个 import 失败，不部分部署。manifest 必须固定 Minecraft、loader、Java、template、config/data/mod 的 sha256 和 rollback snapshot。

apply 在 worker staging 目录下载并校验所有文件后才原子切换；失败保留当前成功 deployment。rollback 必须恢复对应 snapshot 的配置/data，而不是只修改 deployment metadata。

## 验收

- validation report 可解释每个被拒绝文件和 mod 来源。
- deployment manifest 不可变，apply 失败保留旧版本。
- 不兼容模板、hash 不匹配、ZIP 限制、worker staging 失败和 rollback snapshot 缺失都有 fixture。
- preview/apply/rollback 全部异步、幂等并可审计。

# M9 Modpack 部署与来源校验

> 本页只定义上传包白名单、来源校验和部署 manifest 的共享 contract。具体实现见三个子页面。

## Shared contract

```ts
interface ModpackValidationReport {
  importId: string
  sourceFormat: 'mrpack' | 'curseforge_zip'
  status: 'pending' | 'valid' | 'invalid'
  configFiles: string[]
  dataFiles: string[]
  mods: Array<{
    provider: 'modrinth' | 'curseforge'
    projectId: string
    fileId: string
    filename: string
  }>
  rejectedFiles: Array<{ path: string; reason: string }>
}

interface DeploymentManifest {
  manifestVersion: number
  deploymentId: string
  serverId: string
  sourceFormat: 'mrpack' | 'curseforge_zip'
  compatibility: {
    minecraftVersion: string
    loader: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge'
    loaderVersion?: string
    javaMajor: number
    templateId: string
  }
  configFiles: Array<{ path: string; sha256: string; sizeBytes: number }>
  dataFiles: Array<{ path: string; sha256: string; sizeBytes: number }>
  mods: Array<{
    provider: 'modrinth' | 'curseforge'
    projectId: string
    fileId: string
    sha256: string
  }>
  rollbackSnapshotId: string
}
```

上传包只允许 manifest、`config/**` 和 `data/**`；mod 必须由 Modrinth/CurseForge provider/file ID 解析下载。不得上传或执行 jar、exe、dll、so、脚本或任意 URL。

导入校验还必须限制 ZIP 总大小、条目数和压缩比，拒绝符号链接、重复路径、绝对路径和路径穿越。M9 根据 M4/M5 已发布的受支持模板矩阵验证 Minecraft、loader 和 Java 兼容性。manifest 在 preview 后不可变；M5 先将文件和 mod 下载到 staging，再以原子切换应用。rollback 使用 `rollbackSnapshotId` 恢复上一个成功 deployment 的配置/data 快照，不只回滚 metadata。

## Shared API schema

```text
POST /v1/servers/{serverId}/modpack-imports
POST /v1/modpack-imports/{importId}/upload-url
POST /v1/modpack-imports/{importId}/complete
GET  /v1/modpack-imports/{importId}/validation
POST /v1/servers/{serverId}/modpack-deployments
GET  /v1/servers/{serverId}/modpack-deployments
POST /v1/modpack-deployments/{deploymentId}/preview
POST /v1/modpack-deployments/{deploymentId}/apply
POST /v1/modpack-deployments/{deploymentId}/rollback
```

| Endpoint | 作用 | 返回 |
| --- | --- | --- |
| `POST /v1/servers/{serverId}/modpack-imports` | 创建 mrpack/CurseForge ZIP 导入任务。 | `importId`、上传约束 |
| `POST /v1/modpack-imports/{importId}/upload-url` | 获取受限 ZIP 上传地址。 | URL、大小、hash 和过期时间 |
| `POST /v1/modpack-imports/{importId}/complete` | 触发格式、路径和 manifest 校验。 | `202`、`taskId` |
| `GET /v1/modpack-imports/{importId}/validation` | 查询 config/data 白名单和 mod 来源报告。 | validation report |
| `POST /v1/servers/{serverId}/modpack-deployments` | 从有效导入创建不可变 deployment manifest。 | `202`、`deploymentId`、`taskId` |
| `GET /v1/servers/{serverId}/modpack-deployments` | 查询服务器的 deployment 历史。 | 分页 deployment |
| `POST /v1/modpack-deployments/{deploymentId}/preview` | 生成 config/data/mod 变更预览。 | diff |
| `POST /v1/modpack-deployments/{deploymentId}/apply` | 用户确认后应用 deployment manifest。 | `202`、`taskId` |
| `POST /v1/modpack-deployments/{deploymentId}/rollback` | 回滚到上一个成功 deployment manifest。 | `202`、`taskId` |

## Dependencies

依赖 M1 account、M4 server、M5 worker apply；M7 审计导入、来源和部署事件。

## M9 implementation increment (local proposal v1)

本模块消费 `xmcl-web-api/contracts/shared/v1`（README、OpenAPI、schema 和
fixtures）作为已发布的共享边界；不得修改该目录。M9-local mock/proposal 只补充
M9 import/deployment 专属字段，不能重定义共享资源。服务端是 validation report
和 immutable deployment manifest 的唯一权威：

- **Inputs:** M1 authenticated account/scopes；M4 account-owned server 和支持的
  Minecraft/loader/Java/template matrix；M5 staging、atomic switch 和 snapshot
  restore adapter。
- **Owned state:** import、validation report、frozen manifest、deployment command、
  task/idempotency claim 和 worker event deduplication。M9 不直接写 M4 server
  state 或 M5 worker state。
- **Transitions:** `awaiting_upload → validating → valid|invalid`；
  `preparing → draft → previewing → previewed → applying → applied`，以及
  `apply_failed`、`rolling_back → rolled_back|rollback_failed`。重复 command
  返回原 task；同一 idempotency key 的不同 payload、过期状态和冲突 worker
  event 被拒绝；旧 sequence 不覆盖新状态。
- **Security:** only the server parses ZIPs and resolves provider sources. Every
  write requires XMCL session, M9 scope and `Idempotency-Key`; tasks retain
  `requestId`. Signed upload credentials are never forwarded to a provider or
  client UI. Provider, staging, hash and snapshot failures become structured
  task/API errors.

### Shared v1 consumption and exclusions

- **D1/D4 storage:** M9 archive upload is temporary deployment input, not M6
  backup storage accounting. M9 neither reads nor writes `StorageAccountingV1`,
  `usedBytes`, object references, settlement cursors, or the fixed 1 GiB
  policy; M2/M6 remain their only owners.
- **D2/D3 usage:** modpack validation/deployment is not a billable resource in
  v1, so M9 does not request `UsageAuthorization` or produce
  `usage.recorded.v1`. If a priced M9 resource is introduced, it must first
  use the published authorization request and canonical event unchanged,
  including source ordering and idempotency rules.
- **D5 stop escalation:** M9 consumes M4's server lifecycle view. An apply
  refuses a non-running target and preserves the active deployment; the local
  adapter carries the exact `runtime.stopped.v1` balance-exhaustion shape for
  diagnostics. M9 neither publishes usage/stopped events nor force-stops a
  provider: M5/M4 own the required 300-second escalation.
- **D6 administrator operations:** M9 does not consume or complete
  `admin.operation.*.v1`; only M3/M4 own the published actions. A resulting
  M4 stopped/suspended server is treated as not deployable.

Published-contract decisions required from the shared contract owner:

1. Exact create-import checksum/upload-ticket fields and task lookup endpoint.
2. A single deployment preview/result shape shared by desktop and webpage
   consumers, including immutable manifest hash/version semantics.
3. M4's supported-template matrix and M5's staging/snapshot/event schema,
   including producer sequence and retry rules.

## Three subpages

- [Web API 变更](web-api.md)
- [XMCL App 变更](xmcl-app.md)
- [xmcl-page 变更](xmcl-page.md)

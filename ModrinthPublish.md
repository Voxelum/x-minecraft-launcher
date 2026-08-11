# XMCL Modrinth Publish

## 背景

XMCL 已支持浏览、安装和导出 Modrinth modpack，也已通过 OAuth 申请读取、创建和修改 Modrinth project/version 所需的权限。当前发布流程仍需要用户离开启动器，在本地导出文件后再到 Modrinth 网站手动创建项目或版本并上传。

XMCL 的实例同时可以作为本地 dedicated server 运行。Modrinth 发布应使用 MRPack 的环境声明能力描述客户端和服务端文件，而不是额外生成 ready-to-run server ZIP。

## 产品目标

让 modpack 作者能够在 XMCL 内完成从实例到 Modrinth 的完整发布流程：

1. 从当前实例构建符合 Modrinth 规范的 universal、client-only 或 server-only MRPack。
2. 创建新的 Modrinth modpack project，或选择当前账号有权管理的已有 project。
3. 为 project 创建 version，填写发布所需元数据并上传构建产物。
4. 对已配置 localhost dedicated server 的实例，默认生成并发布以 universal MRPack 为 primary file 的 version。
5. 保存实例与 Modrinth project 的关联，使后续发版不必重复选择项目和填写稳定不变的信息。
6. 在上传前明确展示将公开的元数据和文件；在失败后给出可理解、可重试且不会意外重复发布的结果。

这里的“一体化”指用户不需要手动打开 Modrinth 网站或重复上传本地导出文件。Modrinth 的审核、合规要求和最终项目页面仍由 Modrinth 平台负责。

## 用户流程草案

### 首次发布

1. 用户从实例的 modpack/export 区域选择“发布到 Modrinth”。
2. XMCL 检查登录状态、OAuth 权限、实例运行时和待发布文件。
3. 用户选择：
	- 创建新 project；或
	- 发布到自己有管理权限的已有 project。
4. 用户填写或确认 project 信息与 version 信息。
5. XMCL 根据实例状态预选 MRPack profile；用户可以保持默认，也可以选择分开输出 client-only 和 server-only MRPack，并检查每个 profile 的文件。
6. XMCL 先构建并本地校验产物，再创建/更新远端 draft 并上传文件。
7. 用户检查 draft 后显式提交公开/审核；XMCL 不默认直接公开新 project/version。
8. 发布成功后，XMCL 保存实例与 project 的关联，并提供打开 Modrinth project/version 页面的入口。

### 后续发版

1. XMCL 根据实例关联预选 project，并读取最新远端状态。
2. 用户填写新的 version number、version title、changelog、release channel 等版本字段。
3. XMCL 重新构建所选产物，展示与上次发布相比的变化，并创建新 version。

### 项目管理

- 提供独立的 Modrinth 管理页，集中展示实例关联的 project、远端版本历史、draft 状态和最近发布结果。
- 用户可以在管理页修改 project/version 元数据，也可以从管理页开始新发版。
- 发布向导专注于本次构建、版本字段和上传确认，不承担完整的 Modrinth 后台功能。

## 发布对象

### MRPack profiles

- 复用现有 Modrinth `.mrpack` 构建能力，并扩展为三个输出 profile：
  - `universal`：同一个 manifest 同时描述 client 与 server 所需文件。
  - `client-only`：只包含客户端安装所需的文件和 overrides。
  - `server-only`：只包含 dedicated server 安装所需的文件和 overrides。
- Universal MRPack 通过 manifest 中每个文件的 `env.client` / `env.server` 声明两端需求，并分别使用 `overrides/`、`client-overrides/` 和 `server-overrides/`。
- Universal 与 server-only MRPack 都是交给兼容 MRPack 的安装器解析的结构化安装包，不承诺下载后直接解压即可启动服务端。
- 首版不生成或上传 ready-to-run server ZIP。

### 默认选择与 primary file

- 实例未配置 localhost dedicated server 时，默认只输出 client-only MRPack，并设为 Modrinth version 的 primary file。
- 实例已配置 localhost dedicated server 时，默认只输出 universal MRPack，并设为 primary file。
- 对已配置 localhost server 的实例，用户可选择“分开输出”。启用后，同一个 Modrinth version 上传 universal、client-only 和 server-only 三个 MRPack，universal 仍为 primary file。
- 三个 profile 共享同一个 project、version number、release channel、game versions、loaders 和 changelog，不创建 server-only 的独立 version 或 project。
- 文件使用稳定命名：`<project>-<version>.mrpack`、`<project>-client-<version>.mrpack` 和 `<project>-server-<version>.mrpack`。
- 启用“分开输出”时，XMCL 在 version changelog 中自动追加三个文件的用途说明，避免只依赖 Modrinth 文件列表和文件名区分安装目标。

### Modrinth API 约束

- 使用 `POST /version` 的 multipart 请求一次创建 version 并上传本次选择的全部 MRPack。
- 请求中的 `file_parts` 列出每个上传文件的 multipart part name；`primary_file` 指向 universal MRPack 对应的 part。普通实例只输出 client-only 时，`primary_file` 指向 client-only MRPack。
- Modrinth API 接受 `.mrpack`，并允许一个 version 请求包含多个 `file_parts`；API 文档没有限制一个 version 只能包含一个 `.mrpack`。
- Draft version 可以不带文件创建；XMCL 的正常发布流程仍在首次请求中上传全部已选择文件，避免依赖后续追加来完成一次发布。
- `PATCH /version/{id}` 提供 `status` 和 `requested_status` 字段，XMCL 使用该接口完成 draft 检查后的提交或公开状态变更。
- 创建、读取和修改 project/version 使用 XMCL Modrinth OAuth app 已获批的对应权限。

### 文件分类与安全

- 依赖文件优先写入 Modrinth manifest；不能通过允许的下载地址获取的文件按用户选择作为 override 或阻止发布。
- loader、Minecraft 版本和 client/server 环境信息应从实例推导，并允许用户在发布前检查。
- 构建 server 环境时复用现有 dedicated server 文件选择规则，避免把日志、缓存、账号信息、密钥或其他本机私有数据写入 MRPack。
- Server profile 默认额外包含 `server.properties`；world、玩家数据、ops/whitelist/ban 列表和启动参数默认排除，必须由用户显式选择。
- `eula.txt`、world、玩家数据、白名单、封禁列表、服务端地址和凭据等敏感或有法律含义的文件必须有明确策略，不能静默包含在任何 profile 中。

## 可验证目标（Definition of Done）

### 账号与权限

- 未登录 Modrinth 时，发布入口会引导用户完成 OAuth 登录，取消登录不会丢失已填写的发布草稿。
- 权限不足、token 失效或账号对目标 project 无管理权限时，在创建远端对象前给出明确提示并允许重新授权。
- 只能选择当前账号有权创建 version/修改的 project，不能仅凭 project ID 向无权限项目发布。

### 新建 project

- 用户可在 XMCL 中填写 Modrinth 创建 modpack project 的全部必填字段和常用可选字段，并看到平台校验错误对应到具体字段。
- 首版表单至少覆盖名称、slug、summary、description、license、categories、客户端/服务端支持状态和图标；低频高级设置可以提供打开 Modrinth 网页继续编辑的入口。
- 成功后可在 Modrinth 网页看到 project，且名称、slug、summary、description、license、categories、支持的 game versions/loaders、客户端/服务端支持状态和图标与用户确认的内容一致。
- 如果 project 创建成功但 version 上传失败，XMCL 会明确显示部分成功状态，并可从该 project 继续重试，不会再次创建重复 project。
- 首版也支持修改已有 project 的公共元数据；所有修改都必须在提交前展示差异并由用户确认。
- Project 关联、文件选择和发布默认值保存在实例元数据中，并参与实例同步；OAuth token 和任何凭据不进入实例元数据或同步数据。
- 两台设备对同一实例发布配置产生同步冲突时，发布前同时展示本地版本和同步版本，由用户选择使用哪一份；不得静默按最后修改覆盖。

### 发布新 version

- 用户可向已关联或手动选择的 project 创建 version，并设置至少：version number、title、changelog、release channel、game version 和 loader。
- 上传前 XMCL 校验 version number/文件名冲突、必填字段、空产物、文件大小及 Modrinth API 可预先判断的限制。
- 成功后 Modrinth version 页面中的元数据与文件和用户发布前确认的内容一致，主文件标识正确，文件 hash 可与本地产物核对。
- 网络中断或 API 错误不会显示为成功；重试前会查询远端结果，避免同一次操作生成重复 version。
- 首版支持修改 version 元数据，但不提供 archive、unlist 或永久删除 project/version 的操作。
- Draft version 可以替换文件；version 一旦公开，产物视为不可变，任何文件变化都必须使用新的 version number 创建新 version。
- 新建 project/version 默认保持 draft。只有用户在上传完成并检查结果后执行明确的提交操作，才进入公开或平台审核状态。

### MRPack profiles

- 从普通实例发布默认 client-only MRPack 后，可以从 Modrinth 重新安装为新客户端实例并成功启动。
- 从已配置 localhost server 的实例发布默认 universal MRPack 后，同一文件可以分别安装为客户端实例和 dedicated server，并成功启动对应环境。
- 启用“分开输出”后，client-only 和 server-only MRPack 的有效文件集合分别与 universal MRPack 按 client/server 环境解析后的结果一致。
- Universal manifest 中 Minecraft、loader、依赖、`env` 和 override 路径正确；纯客户端文件不会进入 server 安装结果，纯服务端文件不会进入 client 安装结果。
- Universal 是 primary file；分开输出的 client-only/server-only 文件在同一个 Modrinth version 中可下载，且三个文件的 version 元数据一致。
- 分开输出时，Modrinth version changelog 包含由 XMCL 追加的文件用途说明，并保留用户原有 changelog 内容。
- 所有 profile 都不包含账号 token、SSH 凭据、日志、崩溃报告、缓存或未明确选择的 world/player 数据。
- 遇到不能合法重新分发或不符合 Modrinth 下载域名规则的依赖时，发布前会列出问题与处理方式，而不是静默遗漏。

### 状态、恢复与可观察性

- 发布过程区分构建、校验、创建 project、创建 version、上传文件和完成等阶段，并显示可操作的失败原因。
- 关闭或重开页面后，已完成的远端步骤可被识别；发布草稿记录远端 project/version ID 和各阶段结果，用户能从未完成阶段继续或放弃本次草稿。
- 首版不要求单个文件的断点续传；文件上传中断时可以重传该文件，但不能重复创建 project/version。
- 成功页提供 project/version 链接，并记录最近一次发布的 project ID、version ID、产物 hash 和时间。
- 生成的 MRPack profiles 均保留在本地；首版通过测试人员从 Modrinth 下载后，分别以 client/server 目标安装并人工启动来完成端到端验收，不要求自动 smoke test。
- 产物默认归档到按 Modrinth project/version 划分的固定目录，目录中的文件名与上传文件名一致，以支持重试、审计和 hash 对照。
- 本地产物自构建之日起保留 30 天；清理任务只删除超过 30 天且不属于进行中发布草稿的产物。删除本地产物不影响实例发布记录和远端 project/version。

## 初版非目标

- 在 XMCL 内替代 Modrinth 的审核、moderation、团队成员与收益管理后台。
- 自动绕过第三方文件的再分发许可或 Modrinth 平台限制。
- 自动发布到 CurseForge 或其他平台。
- 在没有用户确认的情况下自动覆盖 project 元数据、删除远端 version 或发布新版本。
- Archive、unlist 或永久删除远端 project/version。
- 首版即支持完整 CI/CD、定时发布或多人同时编辑同一发布草稿。
- 单个上传文件的分片断点续传。

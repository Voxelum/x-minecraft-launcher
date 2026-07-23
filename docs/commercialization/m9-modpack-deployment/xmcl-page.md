# M9 xmcl-page 变更

## 边界

官网展示支持的 mrpack/CurseForge ZIP 格式、上传白名单、mod 来源政策和部署流程；如提供登录控制台，不能在浏览器执行 mod 下载或信任判断。

## 代码位置

- `xmcl-page/src/en/commercialization/modpack-deployment.md`
- `xmcl-page/.vitepress/theme/components/commercialization/ModpackImport.vue`
- `xmcl-page/.vitepress/theme/components/commercialization/DeploymentPreview.vue`

## API consumer

调用 M9 import、validation、preview、apply 和 rollback API；浏览器只展示服务端 validation report。

## 验收

- 公开页面明确禁止 jar/exe/脚本和任意 mod URL。
- 支持 Modrinth/CurseForge 来源政策说明。
- 部署失败、拒绝项和回滚流程有清晰文案。

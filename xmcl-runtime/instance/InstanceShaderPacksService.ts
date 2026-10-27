import {
  InstanceShaderPacksService as IInstanceShaderPacksServic,
  InstanceShaderPacksServiceKey,
  shaderPackTargetPath,
  type ShaderPackLangDocument,
  type ShaderPackLangFileInfo,
} from '@xmcl/runtime-api'
import { ResourceDomain } from '@xmcl/resource'
import { stat } from 'fs-extra'
import { basename, join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { ZipManager } from '~/infra'
import { ExposeServiceKey, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { mergeShaderPackLang, parseShaderPackLang } from '../util/shaderPackLang'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'
import { listShaderPackZipLangs, readShaderPackZipEntry, writeShaderPackZipEntry } from './shaderPackZip'

/** 未指定目标语言时的默认值 */
const DEFAULT_TARGET_LOCALE = 'zh_cn'

@ExposeServiceKey(InstanceShaderPacksServiceKey)
export class InstanceShaderPacksService extends AbstractInstanceDomainService implements IInstanceShaderPacksServic {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, ResourceDomain.ShaderPacks)
  }

  /**
   * 解析光影包 zip 的绝对路径，并做目录穿越与文件类型校验。
   */
  private async getArchivePath(instancePath: string, fileName: string) {
    // fileName 必须是纯文件名，禁止通过路径跳出 shaderpacks 目录
    if (!fileName || basename(fileName) !== fileName) {
      throw new Error(`Invalid shaderpack file name: ${fileName}`)
    }
    const filePath = join(instancePath, this.domain, fileName)
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      throw new Error('Only shaderpack archives (.zip) can be translated')
    }
    return filePath
  }

  async listLangFiles(
    instancePath: string,
    fileName: string,
    targetLocale: string = DEFAULT_TARGET_LOCALE,
  ): Promise<ShaderPackLangFileInfo[]> {
    const archivePath = await this.getArchivePath(instancePath, fileName)
    const langs = await listShaderPackZipLangs(archivePath)
    const paths = langs.map(lang => lang.path)
    const result: ShaderPackLangFileInfo[] = []

    for (const lang of langs) {
      const buffer = await readShaderPackZipEntry(archivePath, lang.path)
      const parsed = parseShaderPackLang(buffer)
      const targetPath = shaderPackTargetPath(lang.path, targetLocale, paths)
      result.push({
        path: lang.path,
        locale: lang.locale,
        entries: parsed.entries.length,
        bytes: lang.bytes,
        targetPath,
        targetExists: paths.some(path => path.toLowerCase() === targetPath.toLowerCase()),
      })
    }
    return result
  }

  async readLangFile(
    instancePath: string,
    fileName: string,
    langPath: string,
    targetLocale: string = DEFAULT_TARGET_LOCALE,
  ): Promise<ShaderPackLangDocument> {
    const archivePath = await this.getArchivePath(instancePath, fileName)
    const langs = await listShaderPackZipLangs(archivePath)
    const paths = langs.map(lang => lang.path)
    const source = paths.find(path => path.toLowerCase() === langPath.toLowerCase())
    if (!source) throw new Error(`Shader language file not found: ${langPath}`)

    const buffer = await readShaderPackZipEntry(archivePath, source)
    const parsed = parseShaderPackLang(buffer)
    const targetPath = shaderPackTargetPath(source, targetLocale, paths)
    return {
      path: source,
      locale: basename(source).replace(/\.lang$/i, ''),
      entries: parsed.entries,
      targetPath,
      targetExists: paths.some(path => path.toLowerCase() === targetPath.toLowerCase()),
    }
  }

  async writeTranslatedLangFile(
    instancePath: string,
    fileName: string,
    sourceLangPath: string,
    targetLocale: string,
    translations: Record<string, string>,
  ): Promise<string> {
    const archivePath = await this.getArchivePath(instancePath, fileName)
    const langs = await listShaderPackZipLangs(archivePath)
    const paths = langs.map(lang => lang.path)
    const sourcePath = paths.find(path => path.toLowerCase() === sourceLangPath.toLowerCase())
    if (!sourcePath) throw new Error(`Shader language file not found: ${sourceLangPath}`)

    const targetPath = shaderPackTargetPath(sourcePath, targetLocale, paths)
    // 源语言与目标语言相同则拒绝写回
    if (targetPath.toLowerCase() === sourcePath.toLowerCase()) {
      throw new Error('The source and target language are the same')
    }

    const source = parseShaderPackLang(await readShaderPackZipEntry(archivePath, sourcePath))
    const target = paths.some(path => path.toLowerCase() === targetPath.toLowerCase())
      ? parseShaderPackLang(await readShaderPackZipEntry(archivePath, targetPath))
      : undefined
    // 只有全部校验通过才会得到完整 Buffer，避免写出半成品
    const content = mergeShaderPackLang(source, target, translations)

    await writeShaderPackZipEntry({
      filePath: archivePath,
      entryPath: targetPath,
      content,
    })

    // 写回后让 zip 管理器丢弃旧句柄，保证下一次读取打开的是替换后的文件
    const manager = await this.app.registry.get(ZipManager)
    manager.invalidate(archivePath)

    // 资源状态刷新改为后台执行：并发 worker 较多时 revalidate 可能长时间不返回，
    // 若同步等待会把 IPC 请求挂住，表现为进度 100% 后一直转圈。
    const stateManager = await this.app.registry.get(ServiceStateManager)
    void stateManager.revalidate(`instance-${this.domain}://${instancePath}`).catch((error) => {
      // 后台刷新失败只记录日志，不影响已经完成的翻译写回
      this.warn(`Fail to revalidate shader pack resources of ${instancePath}: ${error}`)
    })
    return targetPath
  }
}

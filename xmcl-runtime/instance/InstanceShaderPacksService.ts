import { lstat, realpath } from 'fs/promises'
import { basename, dirname, join, resolve } from 'path'
import { ResourceDomain } from '@xmcl/resource'
import {
  InstanceShaderPacksService as IInstanceShaderPacksServic,
  InstanceShaderPacksServiceKey,
  ShaderPackLangDocument,
  ShaderPackLangFileInfo,
  ShaderPackLangWriteOptions,
  ShaderPackLangWriteResult,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { ExposeServiceKey, ServiceStateManager } from '~/service'
import { decodeShaderLangFile, fillMissingShaderLang, parseShaderLang } from '~/util/shaderPackLang'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'
import {
  getShaderLangFileLocale,
  listShaderPackLangEntries,
  readShaderPackLangBuffer,
  resolveShaderLangTargetPath,
  toMcLangCode,
  writeShaderPackLangBuffer,
} from './shaderPackZip'

@ExposeServiceKey(InstanceShaderPacksServiceKey)
export class InstanceShaderPacksService extends AbstractInstanceDomainService implements IInstanceShaderPacksServic {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, ResourceDomain.ShaderPacks)
  }

  /**
   * 列出光影包内的语言文件，并计算目标语言路径。
   */
  async listShaderPackLangFiles(packPath: string, targetLocale: string): Promise<ShaderPackLangFileInfo[]> {
    const entries = await listShaderPackLangEntries(packPath)
    const paths = entries.map(entry => entry.fileName)
    const target = toMcLangCode(targetLocale)

    // 语言文件通常很小，这里逐个读取以获得精确条目数
    return await Promise.all(entries.map(async (entry) => {
      const targetPath = resolveShaderLangTargetPath(entry.fileName, target, paths)
      const buffer = await readShaderPackLangBuffer(packPath, entry.fileName)
      const parsed = parseShaderLang(decodeShaderLangFile(buffer))
      return {
        path: entry.fileName,
        locale: entry.locale || getShaderLangFileLocale(entry.fileName),
        entries: parsed.entries.length,
        bytes: entry.bytes,
        targetPath,
        targetExists: paths.some(path => path.toLowerCase() === targetPath.toLowerCase()),
      }
    }))
  }

  /**
   * 读取光影包内的某个语言文件。
   */
  async readShaderPackLangFile(packPath: string, langPath: string, targetLocale: string): Promise<ShaderPackLangDocument> {
    const entries = await listShaderPackLangEntries(packPath)
    const paths = entries.map(entry => entry.fileName)
    const resolvedSource = paths.find(path => path.toLowerCase() === langPath.replace(/\\/g, '/').toLowerCase())
    const sourcePath = resolvedSource ?? langPath.replace(/\\/g, '/')
    const buffer = await readShaderPackLangBuffer(packPath, sourcePath)
    const parsed = parseShaderLang(decodeShaderLangFile(buffer))
    const targetPath = resolveShaderLangTargetPath(sourcePath, targetLocale, paths)
    const targetExists = paths.some(path => path.toLowerCase() === targetPath.toLowerCase())
    const targetKeys = targetExists
      ? parseShaderLang(decodeShaderLangFile(await readShaderPackLangBuffer(packPath, targetPath))).entries.map(entry => entry.key)
      : []
    return {
      path: sourcePath,
      targetKeys,
      locale: getShaderLangFileLocale(sourcePath),
      entries: parsed.entries,
      targetPath,
      targetExists,
    }
  }

  /**
   * 把翻译结果合并进目标语言文件，并保存到独立光影包 ZIP。
   */
  async writeShaderPackLangFile(options: ShaderPackLangWriteOptions): Promise<ShaderPackLangWriteResult> {
    const { instancePath, packPath, sourcePath, targetLocale, translations } = options
    const instanceDir = join(await realpath(instancePath), this.domain)
    const shared = await realpath(await this.getSharedDirectory()).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
    if (await realpath(instanceDir) !== instanceDir || instanceDir === shared) {
      throw new Error('Unlink the shared shaderpacks folder before translating.')
    }
    const sourceStat = await lstat(packPath)
    if (await realpath(dirname(resolve(packPath))) !== instanceDir || !sourceStat.isFile()) {
      throw new Error('The shader pack must be a local ZIP in the instance shaderpacks folder.')
    }
    const entries = await listShaderPackLangEntries(packPath)
    const paths = entries.map(entry => entry.fileName)

    // 大小写不敏感匹配源文件，避免前端拿到旧路径时写回失败
    const normalizedSource = sourcePath.replace(/\\/g, '/').toLowerCase()
    const sourceEntry = entries.find(entry => entry.fileName.toLowerCase() === normalizedSource)
    if (!sourceEntry) {
      throw new Error(`Language file not found in shader pack: ${sourcePath}`)
    }

    const target = toMcLangCode(targetLocale)
    if (!/^[a-z]{2,3}(?:_[a-z0-9]{2,8})?$/.test(target)) throw new Error('Invalid target locale')
    if (toMcLangCode(sourceEntry.locale) === target) {
      throw new Error('Source and target language are the same')
    }
    const targetPath = resolveShaderLangTargetPath(sourceEntry.fileName, target, paths)

    const sourceParsed = parseShaderLang(decodeShaderLangFile(await readShaderPackLangBuffer(packPath, sourceEntry.fileName)))
    const targetExists = paths.some(path => path.toLowerCase() === targetPath.toLowerCase())
    const targetBuffer = targetExists ? await readShaderPackLangBuffer(packPath, targetPath) : undefined
    const filled = fillMissingShaderLang(sourceParsed, targetBuffer && parseShaderLang(decodeShaderLangFile(targetBuffer)), translations)
    if (!filled) return { path: targetPath, written: 0, bytes: 0 }
    const { content, written } = filled
    const buffer = Buffer.from(content, 'utf-8')

    const fileName = `${basename(packPath).slice(0, -4)}.translated-${target}.zip`
    const outputPath = join(instanceDir, fileName)
    await writeShaderPackLangBuffer(packPath, outputPath, targetPath, buffer, async () => {
      const current = await lstat(packPath)
      if (current.dev !== sourceStat.dev || current.ino !== sourceStat.ino || current.size !== sourceStat.size || current.ctimeMs !== sourceStat.ctimeMs) {
        throw new Error('The original shader pack changed during translation. Try again.')
      }
      if (await realpath(instanceDir) !== instanceDir) {
        throw new Error('The instance shaderpacks folder changed during translation.')
      }
    })
    // 失效该实例的光影资源缓存；不阻塞写回结果，实际重扫由资源监听器完成
    revalidateShaderPacks(this.app, this.domain, instancePath)
    this.log(`Written shader language file ${targetPath} (${written} entries) to ${outputPath}`)

    return {
      fileName,
      path: targetPath,
      written,
      bytes: buffer.length,
    }
  }
}

/**
 * 让下一次读取重新扫描光影包目录。
 */
function revalidateShaderPacks(app: LauncherApp, domain: ResourceDomain, instancePath: string) {
  if (!instancePath) return
  const key = `instance-${domain}://${instancePath}`
  app.registry.get(ServiceStateManager)
    .then(stateManager => stateManager.revalidate(key))
    .catch(error => app.getLogger('InstanceShaderPacksService').warn(`Failed to revalidate shader packs of ${instancePath}: ${error}`))
}

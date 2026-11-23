import { ResourceDomain } from '@xmcl/resource'
import {
  InstanceShaderPacksService as IInstanceShaderPacksServic,
  InstanceShaderPacksServiceKey,
  ShaderPackLangDocument,
  ShaderPackLangEntry,
  ShaderPackLangFileInfo,
  ShaderPackLangWriteOptions,
  ShaderPackLangWriteResult,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { ExposeServiceKey, ServiceStateManager } from '~/service'
import { decodeShaderLangFile, mergeShaderLang, parseShaderLang } from '~/util/shaderPackLang'
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
    return {
      path: sourcePath,
      locale: getShaderLangFileLocale(sourcePath),
      entries: parsed.entries,
      targetPath,
      targetExists: paths.some(path => path.toLowerCase() === targetPath.toLowerCase()),
    }
  }

  /**
   * 把翻译结果合并进目标语言文件，并原子写回光影包 zip。
   */
  async writeShaderPackLangFile(options: ShaderPackLangWriteOptions): Promise<ShaderPackLangWriteResult> {
    const { instancePath, packPath, sourcePath, targetLocale, translations } = options
    const entries = await listShaderPackLangEntries(packPath)
    const paths = entries.map(entry => entry.fileName)

    // 大小写不敏感匹配源文件，避免前端拿到旧路径时写回失败
    const normalizedSource = sourcePath.replace(/\\/g, '/').toLowerCase()
    const sourceEntry = entries.find(entry => entry.fileName.toLowerCase() === normalizedSource)
    if (!sourceEntry) {
      throw new Error(`Language file not found in shader pack: ${sourcePath}`)
    }

    const target = toMcLangCode(targetLocale)
    if (toMcLangCode(sourceEntry.locale) === target) {
      throw new Error('Source and target language are the same')
    }
    const targetPath = resolveShaderLangTargetPath(sourceEntry.fileName, target, paths)

    const sourceParsed = parseShaderLang(decodeShaderLangFile(await readShaderPackLangBuffer(packPath, sourceEntry.fileName)))
    const targetExists = paths.some(path => path.toLowerCase() === targetPath.toLowerCase())
    const targetBuffer = targetExists ? await readShaderPackLangBuffer(packPath, targetPath) : undefined
    // 目标文件存在时以目标为模板，保留已有注释与人工翻译
    const template = targetBuffer ? parseShaderLang(decodeShaderLangFile(targetBuffer)) : sourceParsed

    const map = validateTranslations(sourceParsed.entries, translations)
    const merged = mergeShaderLang(template, map, sourceParsed.entries)
    const buffer = Buffer.from(merged, 'utf-8')

    await writeShaderPackLangBuffer(packPath, targetPath, buffer)
    // 失效该实例的光影资源缓存；不阻塞写回结果，实际重扫由资源监听器完成
    revalidateShaderPacks(this.app, this.domain, instancePath)
    this.log(`Written shader language file ${targetPath} (${map.size} entries) to ${packPath}`)

    return {
      path: targetPath,
      written: map.size,
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

/**
 * 校验译文完整性：键必须来自源文件、不能重复，且非空源值必须有非空译文。
 *
 * 放在模块作用域而不是服务方法，避免被 IPC 按名字直接调用。
 */
function validateTranslations(source: readonly ShaderPackLangEntry[], translations: readonly ShaderPackLangEntry[]) {
  const sourceKeys = new Set(source.map(entry => entry.key))
  const map = new Map<string, string>()
  for (const entry of translations) {
    if (typeof entry.key !== 'string' || typeof entry.value !== 'string') {
      throw new Error('Invalid translation entry')
    }
    if (!sourceKeys.has(entry.key)) {
      throw new Error(`Unexpected translation key: ${entry.key}`)
    }
    if (map.has(entry.key)) {
      throw new Error(`Duplicated translation key: ${entry.key}`)
    }
    // 语言文件是逐行的，译文里出现换行会破坏结构
    if (entry.value.includes('\n') || entry.value.includes('\r')) {
      throw new Error(`Translation of ${entry.key} contains a line break`)
    }
    map.set(entry.key, entry.value)
  }
  for (const entry of source) {
    if (entry.value.trim().length === 0) continue
    const translated = map.get(entry.key)
    if (translated === undefined || translated.trim().length === 0) {
      throw new Error(`Missing translation for key: ${entry.key}`)
    }
  }
  return map
}

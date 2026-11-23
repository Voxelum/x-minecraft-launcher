import { readAllEntries, open, openEntryReadStream, readEntryBuffered } from '@xmcl/unzip'
import { Entry } from '@xmcl/yauzl'
import { randomBytes } from 'crypto'
import { rename, stat, unlink } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { ZipFile as WriteZipFile } from 'yazl'
import { writeZipFile } from '~/util/zip'

/**
 * 光影包语言文件在 zip 内的路径规则。
 *
 * 只识别 `lang/` 与 `shaders/lang/` 一层目录，大小写不敏感。
 */
export const SHADER_LANG_PATH_RE = /^(?:shaders\/)?lang\/([^/]+)\.lang$/i

/**
 * 写回时使用的临时文件后缀。
 *
 * 不能用 `.zip` 结尾：光影资源扫描器会把 `shaderpacks/` 下所有 zip 当光影包，
 * 临时文件被扫到就会报 FileNotFoundError。
 */
export const SHADER_LANG_TEMP_SUFFIX = '.xmcl-lang-tmp'

/** 单语言代码到常用地区的映射，用于把 `zh` 这类代码规范成 `zh_cn` */
const DEFAULT_REGION: Record<string, string> = {
  ar: 'ar_sa',
  de: 'de_de',
  en: 'en_us',
  es: 'es_es',
  fr: 'fr_fr',
  it: 'it_it',
  ja: 'ja_jp',
  ko: 'ko_kr',
  nl: 'nl_nl',
  pl: 'pl_pl',
  pt: 'pt_br',
  ru: 'ru_ru',
  tr: 'tr_tr',
  uk: 'uk_ua',
  zh: 'zh_cn',
}

/** 特殊的地区别名，跟随 Minecraft 的语言目录习惯 */
const REGION_ALIAS: Record<string, string> = {
  en_in: 'en_us',
  ar_eg: 'ar_sa',
}

/**
 * 把任意 locale 规范化为 Minecraft 风格的 `xx_yy`。
 */
export function toMcLangCode(locale: string): string {
  const normalized = locale.trim().toLowerCase().replace(/-/g, '_')
  if (!normalized) return 'en_us'
  if (REGION_ALIAS[normalized]) return REGION_ALIAS[normalized]
  if (normalized.includes('_')) return normalized
  return DEFAULT_REGION[normalized] ?? normalized
}

/** 该 zip 条目是否是语言文件 */
export function isShaderLangPath(path: string): boolean {
  return SHADER_LANG_PATH_RE.test(path.replace(/\\/g, '/'))
}

/**
 * 取语言文件所在目录（保留原始大小写），如 `shaders/lang/en_US.lang` → `shaders/lang`。
 */
function dirOfLangEntry(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index < 0 ? '' : normalized.slice(0, index)
}

/**
 * 计算目标语言文件在 zip 内的路径。
 *
 * - 源文件名地区为大写（`en_US.lang`）时目标为 `zh_CN.lang`，小写时目标为 `zh_cn.lang`；
 * - 若 zip 中已存在等价路径（仅大小写不同），复用已有路径，避免出现两个语言文件。
 */
export function resolveShaderLangTargetPath(sourcePath: string, targetLocale: string, existingPaths: readonly string[]): string {
  const normalizedSource = sourcePath.replace(/\\/g, '/')
  const sourceLocale = SHADER_LANG_PATH_RE.exec(normalizedSource)?.[1] ?? ''
  const target = toMcLangCode(targetLocale)
  const [targetLang, targetRegion = ''] = target.split('_')
  const upperRegion = /^[a-z]+_[A-Z]{2}$/.test(sourceLocale)
  const formatted = targetRegion
    ? `${targetLang}_${upperRegion ? targetRegion.toUpperCase() : targetRegion.toLowerCase()}`
    : targetLang

  const dir = dirOfLangEntry(normalizedSource)
  const candidate = dir ? `${dir}/${formatted}.lang` : `${formatted}.lang`
  // 复用大小写不同但等价的已有路径
  const existing = existingPaths.find(path => path.toLowerCase() === candidate.toLowerCase())
  return existing ?? candidate
}

/** 从 zip 内路径取语言代码，如 `shaders/lang/en_US.lang` → `en_US` */
export function getShaderLangFileLocale(path: string): string {
  return SHADER_LANG_PATH_RE.exec(path.replace(/\\/g, '/'))?.[1] ?? ''
}

/**
 * 取源条目的完整 16 位 unix mode（含文件类型位，如 0o100664 / 0o40775）。
 *
 * 只取 `& 0o777` 会丢掉类型位，写回后条目会变成"未知类型"。
 */
function getEntryMode(entry: Entry): number | undefined {
  const mode = entry.externalFileAttributes >>> 16
  // Windows 上创建的 zip 高位可能为 0，交给 yazl 使用默认值
  return mode === 0 ? undefined : mode
}

/** 文件条目选项：保留修改时间、权限与压缩方式 */
function toEntryOptions(entry: Entry) {
  return {
    mtime: entry.getLastModDate(),
    mode: getEntryMode(entry),
    compress: entry.compressionMethod !== 0,
  }
}

/**
 * 目录条目选项。
 *
 * yazl 的 `addEmptyDirectory` 明确拒绝 `compress`/`size`（会抛
 * "options.compress not allowed"），所以目录只能传 mtime 和 mode。
 */
function toDirectoryOptions(entry: Entry) {
  return {
    mtime: entry.getLastModDate(),
    mode: getEntryMode(entry),
  }
}

/**
 * 校验传入的路径确实是普通 zip 文件。
 */
export async function assertShaderPackZip(packPath: string): Promise<void> {
  if (!packPath || basename(packPath).length === 0) {
    throw new Error('Invalid shader pack path')
  }
  if (!/\.zip$/i.test(packPath)) {
    throw new Error('Only zip shader packs are supported')
  }
  const fstat = await stat(packPath)
  if (!fstat.isFile()) {
    throw new Error('The shader pack is not a regular file')
  }
}

/**
 * 列出 zip 内全部语言文件。
 */
export async function listShaderPackLangEntries(packPath: string): Promise<{ fileName: string; locale: string; bytes: number }[]> {
  await assertShaderPackZip(packPath)
  const zip = await open(packPath)
  try {
    const entries = await readAllEntries(zip)
    return entries
      .filter(entry => !entry.fileName.endsWith('/') && isShaderLangPath(entry.fileName))
      .map(entry => ({
        fileName: entry.fileName.replace(/\\/g, '/'),
        locale: getShaderLangFileLocale(entry.fileName),
        bytes: entry.uncompressedSize,
      }))
  } finally {
    zip.close()
  }
}

/**
 * 读取 zip 内某个语言文件的原始字节。
 *
 * `langPath` 大小写不敏感匹配，防止前端传入大小写不一致的路径导致找不到条目。
 */
export async function readShaderPackLangBuffer(packPath: string, langPath: string): Promise<Buffer> {
  await assertShaderPackZip(packPath)
  const zip = await open(packPath)
  try {
    const entries = await readAllEntries(zip)
    const target = entries.find(entry => entry.fileName.toLowerCase() === langPath.replace(/\\/g, '/').toLowerCase())
    if (!target) throw new Error(`Language file not found in shader pack: ${langPath}`)
    return await readEntryBuffered(zip, target)
  } finally {
    zip.close()
  }
}

/**
 * 重写 zip 并原子替换原文件：新增或替换目标语言文件，其它条目原样复制。
 */
export async function writeShaderPackLangBuffer(packPath: string, targetPath: string, content: Buffer): Promise<{ replaced: boolean }> {
  await assertShaderPackZip(packPath)
  if (!isShaderLangPath(targetPath)) {
    throw new Error(`Invalid shader language target path: ${targetPath}`)
  }

  const zip = await open(packPath)
  const output = new WriteZipFile()
  let replaced = false
  const tempPath = join(dirname(packPath), `.${Date.now()}-${randomBytes(4).toString('hex')}${SHADER_LANG_TEMP_SUFFIX}`)
  const backupPath = `${tempPath}.bak`
  try {
    const entries = await readAllEntries(zip)
    // 目标只允许出现一次，避免生成重复条目
    const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase()
    const duplicated = entries.filter(entry => entry.fileName.toLowerCase() === normalizedTarget)
    if (duplicated.length > 1) {
      throw new Error(`Duplicated language entry in shader pack: ${targetPath}`)
    }

    for (const entry of entries) {
      if (entry.fileName.endsWith('/')) {
        output.addEmptyDirectory(entry.fileName, toDirectoryOptions(entry))
        continue
      }
      if (entry.fileName.toLowerCase() === normalizedTarget) {
        output.addBuffer(content, entry.fileName, toEntryOptions(entry))
        replaced = true
        continue
      }
      // 逐条流式复制，保留修改时间、权限与压缩方式；一次只保留当前条目数据
      output.addReadStream(await openEntryReadStream(zip, entry), entry.fileName, toEntryOptions(entry))
    }
    if (!replaced) {
      output.addBuffer(content, targetPath, { mtime: new Date() })
    }

    await writeZipFile(output, tempPath)
  } catch (e) {
    await unlink(tempPath).catch(() => undefined)
    throw e
  } finally {
    zip.close()
  }

  let backedUp = false
  try {
    // 先改名备份再替换，任何一步失败都恢复原包
    await rename(packPath, backupPath)
    backedUp = true
    await rename(tempPath, packPath)
    await unlink(backupPath).catch(() => undefined)
    return { replaced }
  } catch (e) {
    if (backedUp) {
      await rename(backupPath, packPath).catch(() => undefined)
    }
    await unlink(tempPath).catch(() => undefined)
    throw e
  }
}

import { open, readAllEntries, readEntryBuffered } from '@xmcl/unzip'
import { Entry } from '@xmcl/yauzl'
import { rename, unlink } from 'fs-extra'
import { dirname, join } from 'path'
import { ZipFile } from 'yazl'
import { writeZipFile } from '../util/zip'

// 只识别 lang/ 与 shaders/lang/ 一层目录下的语言文件
const LANG_ENTRY = /^(?:shaders\/)?lang\/([^/]+)\.lang$/i

export interface ShaderPackZipLangFile {
  path: string
  locale: string
  bytes: number
}

function isLangEntry(fileName: string) {
  return LANG_ENTRY.test(fileName.replace(/\\/g, '/'))
}

/**
 * 列出 zip 内的语言文件条目（只读取条目目录，不解压整个光影包）。
 */
export async function listShaderPackZipLangs(filePath: string) {
  const zip = await open(filePath)
  try {
    const entries = await readAllEntries(zip)
    return entries
      .filter(entry => isLangEntry(entry.fileName) && !entry.fileName.endsWith('/'))
      .map((entry) => {
        const match = entry.fileName.replace(/\\/g, '/').match(LANG_ENTRY)!
        return {
          path: entry.fileName.replace(/\\/g, '/'),
          locale: match[1].replace(/\.lang$/i, ''),
          bytes: entry.uncompressedSize,
        }
      })
  } finally {
    zip.close()
  }
}

/**
 * 读取 zip 内单个语言文件内容，条目路径大小写不敏感匹配。
 */
export async function readShaderPackZipEntry(filePath: string, entryPath: string): Promise<Buffer> {
  const zip = await open(filePath)
  try {
    const entries = await readAllEntries(zip)
    const normalized = entryPath.replace(/\\/g, '/').toLowerCase()
    const entry = entries.find(e => e.fileName.replace(/\\/g, '/').toLowerCase() === normalized)
    if (!entry) throw new Error(`Shader language file not found: ${entryPath}`)
    return await readEntryBuffered(zip, entry)
  } finally {
    zip.close()
  }
}

/**
 * 用「先备份再改名」的方式原子替换文件，替换失败时恢复原文件。
 */
async function atomicReplace(filePath: string, tempPath: string, onBeforeReplace?: () => Promise<void>) {
  const backupPath = `${filePath}.xmcl-lang-backup`
  await unlink(backupPath).catch(() => undefined)
  await onBeforeReplace?.()
  await rename(filePath, backupPath)
  try {
    await rename(tempPath, filePath)
    await unlink(backupPath).catch(() => undefined)
  } catch (error) {
    await rename(backupPath, filePath).catch(() => undefined)
    throw error
  }
}

/**
 * 把新的语言文件内容写回 zip。
 *
 * 不直接改动原 zip：先重写整个压缩包到临时文件，全部成功后才替换原文件，
 * 失败时保留原 zip。
 */
export async function writeShaderPackZipEntry(options: {
  filePath: string
  entryPath: string
  content: Buffer
  onBeforeReplace?: () => Promise<void>
}) {
  const { filePath, entryPath, content } = options
  if (!isLangEntry(entryPath)) {
    throw new Error(`Invalid shader language entry path: ${entryPath}`)
  }
  const normalizedTarget = entryPath.replace(/\\/g, '/').toLowerCase()
  const zip = await open(filePath)
  // 临时文件不能以 .zip 结尾：光影包扫描器会把 shaderpacks/ 下所有 *.zip 当作光影包，
  // 若临时文件后缀是 .zip，写入或删除瞬间会被扫描器读到并报出损坏光影包。
  const tempPath = join(dirname(filePath), `.${Date.now()}-${Math.random().toString(36).slice(2)}.xmcl-lang-tmp`)

  try {
    const entries = await readAllEntries(zip)
    const targets = entries.filter(e => e.fileName.replace(/\\/g, '/').toLowerCase() === normalizedTarget)
    if (targets.length > 1) {
      throw new Error(`Duplicate shader language entry: ${entryPath}`)
    }
    const target = targets[0]
    const output = new ZipFile()
    let replaced = false

    for (const entry of entries) {
      const entryName = entry.fileName.replace(/\\/g, '/')
      if (target && entry === target) {
        replaced = true
        const { size: _size, ...options } = zipEntryOptions(entry, content.length)
        output.addBuffer(content, entry.fileName, options)
        continue
      }
      if (entryName.endsWith('/')) {
        output.addEmptyDirectory(entryName, { mtime: entry.getLastModDate() })
        continue
      }
      // 逐条读取，既能限制内存占用，也避免 readAllEntries 之后 zip 游标状态错乱
      const buffer = await readEntryBuffered(zip, entry)
      const { size: _size, ...options } = zipEntryOptions(entry, buffer.length)
      output.addBuffer(buffer, entry.fileName, options)
    }

    if (!replaced) {
      output.addBuffer(content, entryPath, { mtime: new Date() })
    }

    await writeZipFile(output, tempPath)
    zip.close()
    await atomicReplace(filePath, tempPath, options.onBeforeReplace)
  } catch (error) {
    zip.close()
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}

/**
 * 复制原条目的时间、权限与压缩方式，尽量保持光影包其他内容不变。
 */
function zipEntryOptions(entry: Entry, size = entry.uncompressedSize) {
  const mode = entry.externalFileAttributes >>> 16
  return {
    size,
    mtime: entry.getLastModDate(),
    mode: mode || undefined,
    compress: entry.compressionMethod !== 0,
  }
}

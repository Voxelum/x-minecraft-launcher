import { toShaderPackMcLang } from '@xmcl/runtime-api'
import { FileSystem } from '@xmcl/system'
import { pathExists, readFile, readJson } from 'fs-extra'
import { join } from 'path'

/**
 * 语言代码规范化。
 *
 * 具体映射表放在 `@xmcl/runtime-api`，便于渲染进程（光影语言翻译弹窗）复用同一份规则。
 */
export function toMcLang(locale: string): string {
  return toShaderPackMcLang(locale)
}

export async function assignJarLang(
  fs: FileSystem | undefined,
  namespace: string,
  code: string,
  target: Record<string, string>,
): Promise<void> {
  if (!fs) return
  for (const extension of ['json', 'lang']) {
    const path = `assets/${namespace}/lang/${code}.${extension}`
    if (!await fs.existsFile(path)) continue
    const content = await fs.readFile(path, 'utf-8')
    Object.assign(target, extension === 'json' ? JSON.parse(content) : parseLegacyLang(content))
    return
  }
}

function parseLegacyLang(content: string): Record<string, string> {
  return Object.fromEntries(content.split(/\r?\n/).filter(line => !line.startsWith('#') && line.includes('='))
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]))
}

/** Read only the asset index belonging to the selected game version. */
export async function readVanillaLangFromAssets(root: string, indexId: string, code: string): Promise<Record<string, string> | undefined> {
  const indexPath = join(root, 'assets', 'indexes', `${indexId}.json`)
  if (!await pathExists(indexPath)) return undefined
  const index = await readJson(indexPath)
  for (const extension of ['json', 'lang']) {
    const hash = index.objects?.[`minecraft/lang/${code}.${extension}`]?.hash
    if (typeof hash !== 'string' || !/^[a-f0-9]{40}$/i.test(hash)) continue
    const objectPath = join(root, 'assets', 'objects', hash.slice(0, 2), hash)
    if (!await pathExists(objectPath)) return undefined
    if (extension === 'json') return readJson(objectPath)
    return parseLegacyLang(await readFile(objectPath, 'utf-8'))
  }
  return undefined
}

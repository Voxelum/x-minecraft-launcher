import { Version } from '@xmcl/core'
import { FileSystem } from '@xmcl/system'
import { pathExists, readJson } from 'fs-extra'
import { join } from 'path'
import { assignJarLang, readVanillaLangFromAssets, toMcLang } from '../util/minecraftLang'

export interface AdvancementDefinition {
  parent?: string
  icon: string
  frame: 'task' | 'goal' | 'challenge'
  title: string
  description: string
  totalCriteria: number
}

export async function resolveProgressVersion(instancePath: string, gameDataPath?: string, versionId?: string) {
  if (!gameDataPath) return undefined
  let id = versionId
  if (!id) {
    const instanceFile = join(instancePath, 'instance.json')
    if (!await pathExists(instanceFile)) return undefined
    const instance = await readJson(instanceFile)
    id = instance.version || instance.runtime?.minecraft
  }
  if (!id) return undefined
  if (!await pathExists(join(gameDataPath, 'versions', id, `${id}.json`))) return undefined
  const version = await Version.parse(gameDataPath, id)
  return {
    clientJarPath: join(gameDataPath, 'versions', version.minecraftVersion, `${version.minecraftVersion}.jar`),
    assetIndex: version.assetIndex?.id || version.assets,
  }
}

export function translateText(component: unknown, lang: Record<string, string>): string {
  if (typeof component === 'string') return component
  if (Array.isArray(component)) return component.map(c => translateText(c, lang)).join('')
  if (!component || typeof component !== 'object') return ''
  const value = component as { text?: unknown; translate?: string; fallback?: string; with?: unknown[]; extra?: unknown[] }
  let text = typeof value.text === 'string' ? value.text : ''
  if (typeof value.translate === 'string') {
    const template = lang[value.translate] ?? value.fallback ?? value.translate
    let index = 0
    text = template.replace(/%%|%(?:(\d+)\$)?s/g, (match, position) => {
      if (match === '%%') return '%'
      const arg = value.with?.[position ? Number(position) - 1 : index++]
      return arg === undefined ? match : translateText(arg, lang)
    })
  }
  return text + (value.extra?.map(c => translateText(c, lang)).join('') ?? '')
}

export async function readAdvancementDefinitions(
  fs: FileSystem,
  locale: string,
  gameDataPath?: string,
  assetIndex?: string,
): Promise<Record<string, AdvancementDefinition>> {
  const result: Record<string, AdvancementDefinition> = {}
  const code = toMcLang(locale)
  const vanillaLang = gameDataPath && assetIndex && code !== 'en_us'
    ? await readVanillaLangFromAssets(gameDataPath, assetIndex, code)
    : undefined
  // 1.12 stores definitions in assets; 1.13+ uses data, with singular paths in 1.21+.
  for (const root of ['assets', 'data']) {
    if (!await fs.existsFile(root) || !await fs.isDirectory(root)) continue
    for (const namespace of await fs.listFiles(root)) {
      if (!namespace) continue
      const lang: Record<string, string> = {}
      await assignJarLang(fs, namespace, 'en_us', lang)
      if (code !== 'en_us') await assignJarLang(fs, namespace, code, lang)
      if (namespace === 'minecraft' && vanillaLang) Object.assign(lang, vanillaLang)
      for (const directory of ['advancements', 'advancement']) {
        const base = fs.join(root, namespace, directory)
        if (!await fs.existsFile(base) || !await fs.isDirectory(base)) continue
        await walkFiles(fs, base, async path => {
          if (!path.endsWith('.json')) return
          const definition = JSON.parse(await fs.readFile(path, 'utf-8'))
          if (!definition.display) return
          const relative = path.slice(base.length + 1).replace(/\\/g, '/').slice(0, -5)
          const display = definition.display
          result[`${namespace}:${relative}`] = {
            parent: definition.parent,
            icon: display.icon?.id || display.icon?.item || '',
            frame: display.frame || 'task',
            title: translateText(display.title, lang),
            description: translateText(display.description, lang),
            totalCriteria: Object.keys(definition.criteria || {}).length,
          }
        })
      }
    }
  }
  return result
}

async function walkFiles(fs: FileSystem, path: string, read: (path: string) => Promise<void>): Promise<void> {
  if (!await fs.isDirectory(path)) return read(path)
  for (const child of await fs.listFiles(path)) {
    if (child) await walkFiles(fs, fs.join(path, child), read)
  }
}

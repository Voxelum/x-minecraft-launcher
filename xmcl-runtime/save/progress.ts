import {
  InstanceProgressAdvancement,
  InstanceProgressChapter,
  InstanceProgressQuestItem,
  InstanceProgressQuests,
  InstanceProgressStats,
  InstanceSaveProgress,
} from '@xmcl/runtime-api'
import { FileSystem, openFileSystem } from '@xmcl/system'
import { pathExists, readdir, readFile, stat } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { exists } from '../util/fs'
import { parseSnbt } from './snbt'
import { AdvancementDefinition, readAdvancementDefinitions, resolveProgressVersion } from './advancements'

function normalizeId(id: unknown): string {
  if (id === undefined || id === null) return ''
  return String(id)
}

export function extractCleanItemId(raw: any): string {
  if (!raw) return ''
  if (typeof raw === 'object') {
    return raw.id || raw.name || raw.item || ''
  }
  let s = String(raw).trim()
  const imgMatch = s.match(/\{image:([^\s}]+)/i)
  if (imgMatch) return imgMatch[1]
  const idMatch = s.match(/(?:id|item):\s*["']([^"']+)["']/i)
  if (idMatch) return idMatch[1]
  const unquotedMatch = s.match(/(?:id|item):\s*([a-zA-Z0-9_.-]+:[a-zA-Z0-9_./-]+)/i)
  if (unquotedMatch) return unquotedMatch[1]
  if (s.startsWith('{') && s.endsWith('}')) {
    s = s.substring(1, s.length - 1).trim()
  }
  return s
}

export function cleanTitle(title?: string): string {
  if (!title) return ''
  let cleaned = title
    .replace(/\{image:[^}]+\}/gi, '')
    .replace(/\u00a7[0-9a-fk-or]/gi, '')
    .replace(/&[0-9a-fk-or]/gi, '')
    .replace(/^[\p{Extended_Pictographic}\p{Emoji}\p{Symbol}\p{Punctuation}\s]+-\s*/u, '')
    .trim()
  return cleaned || title.trim()
}

async function findLatestFile(dir: string, preferredUuid?: string): Promise<{ file: string; uuid: string } | undefined> {
  if (!await exists(dir)) return undefined
  const files = await readdir(dir).catch(() => [] as string[])
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  if (jsonFiles.length === 0) return undefined

  if (preferredUuid) {
    const match = jsonFiles.find(f => f.toLowerCase() === `${preferredUuid.toLowerCase()}.json`)
    if (match) {
      return { file: join(dir, match), uuid: match.replace(/\.json$/, '') }
    }
  }

  let latestFile = jsonFiles[0]
  let latestMtime = 0
  for (const f of jsonFiles) {
    try {
      const s = await stat(join(dir, f))
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs
        latestFile = f
      }
    } catch (cause) {
      throw new Error(`Cannot inspect progress file: ${join(dir, f)}`, { cause })
    }
  }

  return { file: join(dir, latestFile), uuid: latestFile.replace(/\.json$/, '') }
}

export async function parseAdvancements(
  filePath?: string,
  extraDefinitions: Record<string, AdvancementDefinition> = {},
  includeUnearned: boolean = false,
): Promise<{
  completed: number
  categories: Record<string, number>
  items: InstanceProgressAdvancement[]
}> {
  try {
    let json: Record<string, any> = {}
    if (filePath && await pathExists(filePath)) {
      const content = await readFile(filePath, 'utf-8')
      json = JSON.parse(content)
    }

    const items: InstanceProgressAdvancement[] = []
    const categories: Record<string, number> = {}
    let completed = 0

    const allDefs = extraDefinitions

    const validPlayerKeys = Object.keys(json).filter(k => k !== 'DataVersion' && !k.includes('recipes/'))
    const keys = includeUnearned
      ? new Set([...Object.keys(allDefs), ...validPlayerKeys])
      : validPlayerKeys

    for (const key of keys) {
      const data = json[key]
      const def = allDefs[key]
      const done = Boolean(data?.done)
      const criteria = data?.criteria || {}
      const criteriaCompleted = Object.keys(criteria).length

      const colonIdx = key.indexOf(':')
      const mod = colonIdx !== -1 ? key.substring(0, colonIdx) : 'minecraft'

      if (done) {
        completed++
        categories[mod] = (categories[mod] || 0) + 1
      }

      items.push({
        id: key,
        mod,
        done,
        criteriaCompleted,
        totalCriteria: def?.totalCriteria ?? criteriaCompleted,
        completedTime: done && criteriaCompleted > 0 ? (Object.values(criteria)[0] as string) : undefined,
        parent: def?.parent,
        icon: def?.icon || '',
        frame: def?.frame || 'task',
        title: def?.title || undefined,
        description: def?.description || undefined,
      })
    }

    // Compute tree layout coordinates (x, y) per branch
    layoutAdvancementTree(items)

    // Sort items: completed first, then alphabetical
    items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1
      return a.id.localeCompare(b.id)
    })

    return { completed, categories, items }
  } catch (cause) {
    throw new Error(`Cannot read advancements: ${filePath}`, { cause })
  }
}

/**
 * Assign coordinates (x, y) for 2D tree layout per branch
 */
function layoutAdvancementTree(items: InstanceProgressAdvancement[]) {
  const itemMap = new Map<string, InstanceProgressAdvancement>()
  for (const item of items) {
    itemMap.set(item.id, item)
  }

  // Group by branch key (e.g. minecraft:story, minecraft:adventure)
  const branchMap = new Map<string, InstanceProgressAdvancement[]>()
  for (const item of items) {
    const colonIdx = item.id.indexOf(':')
    const mod = colonIdx !== -1 ? item.id.substring(0, colonIdx) : 'minecraft'
    const path = colonIdx !== -1 ? item.id.substring(colonIdx + 1) : item.id
    const slashIdx = path.indexOf('/')
    const branchName = slashIdx !== -1 ? path.substring(0, slashIdx) : path
    const branchKey = `${mod}:${branchName}`

    const list = branchMap.get(branchKey) || []
    list.push(item)
    branchMap.set(branchKey, list)
  }

  for (const [, branchItems] of branchMap) {
    const branchItemMap = new Map<string, InstanceProgressAdvancement>()
    for (const it of branchItems) branchItemMap.set(it.id, it)

    const roots: InstanceProgressAdvancement[] = []
    const childrenMap = new Map<string, InstanceProgressAdvancement[]>()

    for (const item of branchItems) {
      if (!item.parent || !branchItemMap.has(item.parent)) {
        roots.push(item)
      } else {
        const list = childrenMap.get(item.parent) || []
        list.push(item)
        childrenMap.set(item.parent, list)
      }
    }

    let yOffset = 0
    for (const root of roots) {
      function positionNode(node: InstanceProgressAdvancement, depth: number, yPos: number): number {
        node.x = depth * 1.8
        node.y = yPos

        const children = childrenMap.get(node.id) || []
        if (children.length === 0) {
          return yPos + 1.2
        }

        let nextY = yPos
        for (const child of children) {
          nextY = positionNode(child, depth + 1, nextY)
        }
        return nextY
      }

      const nextRootY = positionNode(root, 0, yOffset)
      yOffset = nextRootY + 1.0
    }
  }
}

export async function parseStats(filePath: string): Promise<InstanceProgressStats | undefined> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const json = JSON.parse(content)
    const statsObj = json.stats || json

    const custom = statsObj['minecraft:custom'] || statsObj
    const mined = statsObj['minecraft:mined'] || {}

    const playTimeTicks = custom['minecraft:play_time'] ??
      custom['minecraft:total_world_time'] ??
      custom['stat.playOneMinute'] ?? 0

    const deaths = custom['minecraft:deaths'] ?? custom['stat.deaths'] ?? 0
    const mobKills = custom['minecraft:mob_kills'] ?? custom['stat.mobKills'] ?? 0
    const damageDealt = custom['minecraft:damage_dealt'] ?? custom['stat.damageDealt'] ?? 0
    const damageTaken = custom['minecraft:damage_taken'] ?? custom['stat.damageTaken'] ?? 0
    const jump = custom['minecraft:jump'] ?? custom['stat.jump'] ?? 0

    let minedBlocksTotal = 0
    for (const count of Object.values(mined)) {
      if (typeof count === 'number') minedBlocksTotal += count
    }

    return {
      playTimeTicks,
      deaths,
      mobKills,
      damageDealt,
      damageTaken,
      jump,
      minedBlocksTotal,
    }
  } catch {
    return undefined
  }
}

export async function locateFtbPlayerFile(savePath: string, playerUuid?: string): Promise<string | undefined> {
  const possiblePlayerDirs = [
    join(savePath, 'ftbquests', 'players'),
    join(savePath, 'ftbquests', 'teams'),
    join(savePath, 'ftbquests'),
    join(savePath, 'serverconfig', 'ftbquests', 'players'),
    join(savePath, 'serverconfig', 'ftbquests', 'teams'),
    join(savePath, 'ftbteams', 'player'),
  ]

  for (const dir of possiblePlayerDirs) {
    if (!await exists(dir)) continue
    if (playerUuid) {
      const candidate = join(dir, `${playerUuid}.snbt`)
      if (await exists(candidate)) {
        return candidate
      }
    }
    const files = await readdir(dir).catch(() => [] as string[])
    const snbtCandidates = files.filter(f => f.endsWith('.snbt') && !['data.snbt', 'chapter_groups.snbt', 'snbt'].includes(f.toLowerCase()))
    if (snbtCandidates.length > 0) {
      let newestFile: string | undefined
      let newestMtime = -1
      for (const f of snbtCandidates) {
        const filePath = join(dir, f)
        const s = await stat(filePath).catch(() => undefined)
        if (s && s.mtimeMs > newestMtime) {
          newestMtime = s.mtimeMs
          newestFile = filePath
        }
      }
      if (newestFile) {
        return newestFile
      }
    }
  }
  return undefined
}

export async function readCompletedQuestIds(playerProgressFile: string): Promise<Set<string>> {
  const completedQuestIds = new Set<string>()
  try {
    const raw = await readFile(playerProgressFile, 'utf-8')
    const parsed = parseSnbt(raw)
    if (parsed) {
      if (parsed.completed) {
        const comp = Array.isArray(parsed.completed) ? parsed.completed : Object.keys(parsed.completed)
        for (const item of comp) completedQuestIds.add(normalizeId(item))
      }
      if (Array.isArray(parsed.quests)) {
        for (const q of parsed.quests) {
          if (q?.id && (q.completed || q.done)) completedQuestIds.add(normalizeId(q.id))
        }
      }
    }
  } catch (cause) {
    throw new Error(`Cannot read quest progress ${playerProgressFile}: ${String(cause)}`, { cause })
  }
  return completedQuestIds
}

export async function parseFtbQuests(
  savePath: string,
  instancePath: string,
  playerUuid?: string,
): Promise<InstanceProgressQuests | undefined> {
  try {
    let chaptersDir: string | undefined
    const possibleChapterDirs = [
      join(instancePath, 'config', 'ftbquests', 'quests', 'chapters'),
      join(instancePath, 'config', 'ftbquests', 'chapters'),
      join(savePath, 'ftbquests', 'quests', 'chapters'),
      join(savePath, 'ftbquests', 'chapters'),
      join(instancePath, 'config', 'ftbquests', 'normal', 'chapters'),
      join(instancePath, 'defaultconfigs', 'ftbquests', 'quests', 'chapters'),
      join(instancePath, 'defaultconfigs', 'ftbquests', 'chapters'),
      join(instancePath, 'kubejs', 'data', 'ftbquests', 'chapters'),
    ]

    for (const dir of possibleChapterDirs) {
      if (await exists(dir)) {
        chaptersDir = dir
        break
      }
    }

    if (!chaptersDir) return undefined

    const chapterFiles = await readdir(chaptersDir).catch(() => [] as string[])
    const snbtFiles = chapterFiles.filter(f => f.endsWith('.snbt'))
    if (snbtFiles.length === 0) return undefined

    // 1. Locate player progress first to calculate completion & locked state
    const playerProgressFile = await locateFtbPlayerFile(savePath, playerUuid)
    const completedQuestIds = playerProgressFile ? await readCompletedQuestIds(playerProgressFile) : new Set<string>()

    // 2. Parse chapters with quest coordinates, shapes, icons, and dependencies
    const chapters: InstanceProgressChapter[] = []
    let totalCompletedQuests = 0
    let totalAllQuests = 0

    for (const file of snbtFiles) {
      try {
        const raw = await readFile(join(chaptersDir, file), 'utf-8')
        const parsed = parseSnbt(raw)
        if (!parsed) continue

        const chapterId = normalizeId(parsed.id || file.replace(/\.snbt$/, ''))
        const rawChapterTitle = parsed.title || parsed.filename || file.replace(/\.snbt$/, '')
        const imgMatch = rawChapterTitle.match(/\{image:([^\s}]+)/i)
        const chapterIcon = extractCleanItemId(parsed.icon) || imgMatch?.[1]
        let chapterTitle = cleanTitle(rawChapterTitle)
        if (!chapterTitle || chapterTitle === parsed.filename || chapterTitle === file.replace(/\.snbt$/, '')) {
          chapterTitle = (parsed.filename || file.replace(/\.snbt$/, '')).replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        }
        const defaultShape = parsed.default_quest_shape || 'circle'
        const rawQuests = Array.isArray(parsed.quests) ? parsed.quests : []

        const questItems: InstanceProgressQuestItem[] = []
        let chCompleted = 0

        for (const q of rawQuests) {
          const qId = normalizeId(q?.id)
          if (!qId) continue

          const isDone = completedQuestIds.has(qId)
          if (isDone) chCompleted++

          // Extract dependencies
          const depsRaw = Array.isArray(q?.dependencies) ? q.dependencies : []
          const dependencies: string[] = depsRaw.map(normalizeId).filter((d: string | undefined): d is string => Boolean(d))

          // Check if locked (if any dependency is incomplete)
          let locked = false
          if (!isDone && dependencies.length > 0) {
            locked = dependencies.some((depId: string) => !completedQuestIds.has(depId))
          }

          // Extract icon
          let icon: string | undefined
          if (q?.icon) {
            icon = extractCleanItemId(q.icon)
          } else if (Array.isArray(q?.tasks)) {
            for (const t of q.tasks) {
              if (t?.icon) {
                icon = extractCleanItemId(t.icon)
                if (icon) break
              }
              if (t?.item) {
                icon = extractCleanItemId(t.item)
                if (icon) break
              }
            }
          }

          // Extract coordinates
          const x = typeof q?.x === 'number' ? q.x : (parseFloat(q?.x) || 0)
          const y = typeof q?.y === 'number' ? q.y : (parseFloat(q?.y) || 0)
          const size = typeof q?.size === 'number' ? q.size : 1
          const shape = q?.shape || defaultShape

          // Format description
          let description: string | undefined
          if (Array.isArray(q?.description)) {
            description = q.description.join('\n')
          } else if (typeof q?.description === 'string') {
            description = q.description
          }

          const tasksCount = Array.isArray(q?.tasks) ? q.tasks.length : 0

          questItems.push({
            id: qId,
            title: cleanTitle(q?.title) || qId,
            subtitle: cleanTitle(q?.subtitle),
            description,
            icon,
            x,
            y,
            size,
            shape,
            dependencies,
            done: isDone,
            locked,
            tasksCount,
            tasksCompleted: isDone ? tasksCount : 0,
          })
        }

        if (questItems.length > 0) {
          totalCompletedQuests += chCompleted
          totalAllQuests += questItems.length
          const percentage = questItems.length > 0 ? Math.round((chCompleted / questItems.length) * 100) : 0

          chapters.push({
            id: chapterId,
            title: chapterTitle,
            icon: chapterIcon,
            defaultShape,
            completedQuests: chCompleted,
            totalQuests: questItems.length,
            percentage,
            quests: questItems,
          })
        }
      } catch (cause) {
        throw new Error(`Cannot read quest chapter ${join(chaptersDir, file)}: ${String(cause)}`, { cause })
      }
    }

    if (totalAllQuests === 0) return undefined

    const overallPercentage = totalAllQuests > 0 ? Math.round((totalCompletedQuests / totalAllQuests) * 100) : 0

    return {
      modType: 'ftbquests',
      completedQuests: totalCompletedQuests,
      totalQuests: totalAllQuests,
      percentage: overallPercentage,
      chapters,
    }
  } catch (cause) {
    throw new Error(`Cannot read quests for save ${savePath}: ${String(cause)}`, { cause })
  }
}

/**
 * Extract textures from local client jar or mod jars
 */
const localTextureCache = new Map<string, string>()

const NS_ALIASES: Record<string, string[]> = {
  ae2: ['appliedenergistics2', 'ae2'],
  appliedenergistics2: ['ae2', 'appliedenergistics2'],
  rs: ['refinedstorage'],
  refinedstorage: ['rs', 'refinedstorage'],
  ie: ['immersiveengineering', 'immersive_engineering'],
  immersiveengineering: ['ie', 'immersiveengineering', 'immersive_engineering'],
  tc: ['tconstruct', 'thaumcraft'],
  tconstruct: ['tc', 'tconstruct'],
  ftbq: ['ftbquests', 'ftb-quests', 'ftb_quests'],
  ftbquests: ['ftbquests', 'ftb-quests', 'ftb_quests'],
  ftbt: ['ftbteams', 'ftb-teams', 'ftb_teams'],
  ftblibrary: ['ftblibrary', 'ftb-library', 'ftb_library'],
  thermal: ['thermal_expansion', 'thermal_foundation', 'thermal'],
  refurbished_furniture: ['refurbished_furniture', 'furniture'],
  endrem: ['endrem', 'end_rem'],
}


function getTextureSubpaths(name: string): string[] {
  const clean = name.replace(/^\/+/, '').replace(/\.png$/i, '')
  if (name.includes('/') || name.endsWith('.png')) {
    return [name, `${clean}.png`, `textures/${clean}.png`, `textures/gui/${clean}.png`, `textures/gui/icons/${clean}.png`]
  }
  return [
    `textures/item/${clean}.png`,
    `textures/block/${clean}.png`,
    `textures/items/${clean}.png`,
    `textures/blocks/${clean}.png`,
    `textures/gui/${clean}.png`,
    `textures/gui/icons/${clean}.png`,
    `textures/${clean}.png`,
  ]
}

async function extractLocalTextures(
  itemIds: string[],
  instancePath: string,
  clientJarPath?: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  if (itemIds.length === 0) return result
  const clientStat = clientJarPath && await pathExists(clientJarPath) ? await stat(clientJarPath) : undefined
  const cacheKey = (id: string) => JSON.stringify([instancePath, clientJarPath, clientStat?.mtimeMs, clientStat?.size, id])

  const missingIds: string[] = []
  for (const id of itemIds) {
    const cached = localTextureCache.get(cacheKey(id))
    if (cached !== undefined) {
      if (cached) result[id] = cached
    } else {
      missingIds.push(id)
    }
  }
  if (missingIds.length === 0) return result

  const openedFs: FileSystem[] = []

  try {
    let clientFs: FileSystem | undefined
    if (clientJarPath) {
      clientFs = await openFileSystem(clientJarPath).catch(() => undefined)
      if (clientFs) openedFs.push(clientFs)
    }

    // Search local instance disk assets (KubeJS, openloader, resources, resourcepacks)
    const localAssetDirs: string[] = []
    const baseDirs = [
      join(instancePath, 'kubejs', 'assets'),
      join(instancePath, 'resources'),
      join(instancePath, 'config', 'openloader', 'resources'),
    ]
    for (const d of baseDirs) {
      if (await pathExists(d)) localAssetDirs.push(d)
    }

    const subPackDirs = [
      join(instancePath, 'resourcepacks'),
      join(instancePath, 'config', 'openloader', 'resources'),
    ]
    for (const dir of subPackDirs) {
      if (await pathExists(dir)) {
        const entries = await readdir(dir).catch(() => [] as string[])
        for (const entry of entries) {
          const candidate = join(dir, entry, 'assets')
          if (await pathExists(candidate)) localAssetDirs.push(candidate)
        }
      }
    }

    // Search instance mods directory for modded textures
    const modsDir = join(instancePath, 'mods')
    const modFiles = await readdir(modsDir).catch(() => [] as string[])
    const modJars = modFiles.filter(f => f.endsWith('.jar'))
    const jarPromiseMap = new Map<string, Promise<FileSystem | null>>()

    function getOrOpenJar(modJar: string): Promise<FileSystem | null> {
      let p = jarPromiseMap.get(modJar)
      if (!p) {
        p = openFileSystem(join(modsDir, modJar)).catch(() => null).then(fs => {
          if (fs) openedFs.push(fs)
          return fs
        })
        jarPromiseMap.set(modJar, p)
      }
      return p
    }

    const targetIds = missingIds.slice(0, 150)

    const extractionWork = Promise.all(targetIds.map(async (itemId) => {
      if (!itemId) return
      const cleanId = extractCleanItemId(itemId)

      const colonIdx = cleanId.indexOf(':')
      const ns = colonIdx !== -1 ? cleanId.substring(0, colonIdx) : 'minecraft'
      const name = colonIdx !== -1 ? cleanId.substring(colonIdx + 1) : cleanId

      let foundDataUrl: string | undefined

      // Check local disk folders first (fastest)
      for (const baseDir of localAssetDirs) {
        foundDataUrl = await readTextureFromDisk(baseDir, ns, name)
        if (foundDataUrl) break
      }

      if (!foundDataUrl && ns === 'minecraft' && clientFs) {
        foundDataUrl = await readTextureFromFs(clientFs, ns, name)
      } else if (!foundDataUrl) {
        const aliases = NS_ALIASES[ns.toLowerCase()] || [ns.toLowerCase()]
        const candidateJars = modJars.filter(j => {
          const jLower = j.toLowerCase()
          return aliases.some(a => jLower.includes(a))
        }).slice(0, 2)

        for (const modJar of candidateJars) {
          const fs = await getOrOpenJar(modJar)
          if (fs) {
            foundDataUrl = await readTextureFromFs(fs, ns, name)
            if (foundDataUrl) break
          }
        }

        if (!foundDataUrl && clientFs) {
          foundDataUrl = await readTextureFromFs(clientFs, 'minecraft', name)
        }
      }

      if (foundDataUrl) {
        result[itemId] = foundDataUrl
        result[cleanId] = foundDataUrl
        localTextureCache.set(cacheKey(itemId), foundDataUrl)
        localTextureCache.set(cacheKey(cleanId), foundDataUrl)
      }
    }))

    await Promise.race([
      extractionWork,
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
  } catch {
  } finally {
    for (const fs of openedFs) {
      try { fs.close() } catch {}
    }
  }

  return result
}

async function readTextureFromDisk(baseDir: string, ns: string, name: string): Promise<string | undefined> {
  for (const sub of getTextureSubpaths(name)) {
    try {
      const p = join(baseDir, ns, sub)
      if (await pathExists(p)) {
        const buf = await readFile(p)
        if (buf && buf.length > 0) return `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch {}
  }

  // Fallback: check models/item and models/block
  const cleanName = name.replace(/^\/+/, '').replace(/\.png$/i, '')
  for (const sub of ['item', 'block']) {
    try {
      const mp = join(baseDir, ns, 'models', sub, `${cleanName}.json`)
      if (await pathExists(mp)) {
        const json = JSON.parse(await readFile(mp, 'utf-8'))
        const texRef = json?.textures?.layer0 || json?.textures?.particle || (json?.textures && Object.values(json.textures)[0])
        if (typeof texRef === 'string') {
          const colon = texRef.indexOf(':')
          const targetNs = colon !== -1 ? texRef.substring(0, colon) : ns
          const targetName = colon !== -1 ? texRef.substring(colon + 1) : texRef
          const res = await readTextureFromDisk(baseDir, targetNs, targetName)
          if (res) return res
        }
      }
    } catch {}
  }

  return undefined
}

async function readTextureFromFs(fs: FileSystem, ns: string, name: string): Promise<string | undefined> {
  for (const sub of getTextureSubpaths(name)) {
    try {
      const buf = await fs.readFileBuffered(`assets/${ns}/${sub}`)
      if (buf && buf.length > 0) return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    } catch {}
  }
  return undefined
}

export async function readSaveProgress(
  savePath: string,
  instancePath: string,
  gameDataPath?: string,
  preferredPlayerUuid?: string,
  locale = 'en',
  versionId?: string,
): Promise<InstanceSaveProgress> {
  const saveName = basename(savePath)

  const levelDatPath = join(savePath, 'level.dat')
  let levelDatMtime = 0
  try {
    const s = await stat(levelDatPath).catch(() => undefined)
    if (s) levelDatMtime = s.mtimeMs
  } catch {}

  const advInfo = await findLatestFile(join(savePath, 'advancements'), preferredPlayerUuid)
  const statsInfo = await findLatestFile(join(savePath, 'stats'), preferredPlayerUuid || advInfo?.uuid)
  const playerUuid = advInfo?.uuid || statsInfo?.uuid || preferredPlayerUuid
  const version = await resolveProgressVersion(instancePath, gameDataPath, versionId)
  let definitions: Record<string, AdvancementDefinition> = {}
  let clientFs: FileSystem | undefined
  try {
    if (version && await pathExists(version.clientJarPath)) {
      clientFs = await openFileSystem(version.clientJarPath)
      definitions = await readAdvancementDefinitions(clientFs, locale, gameDataPath, version.assetIndex)
    }
  } finally {
    clientFs?.close()
  }

  const quests = await parseFtbQuests(savePath, instancePath, playerUuid)
  const isFtbPack = !!quests && quests.chapters.length > 0

  const advancements = await parseAdvancements(advInfo?.file, definitions, !isFtbPack)
  const stats = statsInfo ? await parseStats(statsInfo.file) : undefined

  // Collect item icons needed
  const iconItemIds = new Set<string>()
  if (quests) {
    for (const ch of quests.chapters) {
      if (ch.icon) iconItemIds.add(ch.icon)
      for (const q of ch.quests) {
        if (q.icon) iconItemIds.add(q.icon)
      }
    }
  }
  if (!isFtbPack) {
    for (const adv of advancements.items) {
      if (adv.icon) iconItemIds.add(adv.icon)
    }
  }

  let icons: Record<string, string> = {}
  try {
    // Extract textures locally from Minecraft JAR & mods
    icons = await extractLocalTextures(Array.from(iconItemIds), instancePath, version?.clientJarPath)
  } catch {}

  // Assign data URLs
  for (const adv of advancements.items) {
    if (adv.icon && icons[adv.icon]) {
      adv.iconDataUrl = icons[adv.icon]
    }
  }
  if (quests) {
    for (const ch of quests.chapters) {
      if (ch.icon && icons[ch.icon]) ch.iconDataUrl = icons[ch.icon]
      for (const q of ch.quests) {
        if (q.icon && icons[q.icon]) q.iconDataUrl = icons[q.icon]
      }
    }
  }

  const result: InstanceSaveProgress = {
    savePath,
    saveName,
    playerUuid,
    lastPlayed: levelDatMtime,
    advancements,
    quests,
    stats,
    icons,
  }

  return result
}

import type { Instance } from '@xmcl/instance'
import type { InstanceGroupData, InstanceGroupDataOrString } from '@xmcl/runtime-api'
import { ref, watch } from 'vue'

export type InstanceOrGroupData = InstanceGroupDataOrString

export type AutoGroupStrategy = 'modloader' | 'version' | 'source'

export interface AutoGroupConfig {
  enabled: boolean
  strategy: AutoGroupStrategy
}

const STORAGE_KEY = 'xmcl:autoGroupConfig'

function loadConfig(): AutoGroupConfig {
  try {
const raw = localStorage.getItem(STORAGE_KEY)
if (raw) {
const parsed = JSON.parse(raw)
const strat = parsed.strategy === 'activity' ? 'modloader' : (parsed.strategy || 'modloader')
return {
enabled: !!parsed.enabled,
strategy: strat,
      }
    }
  } catch {
  }
return {
enabled: true,
strategy: 'modloader',
  }
}

export const autoGroupConfig = ref<AutoGroupConfig>(loadConfig())

watch(
autoGroupConfig,
(cfg) => {
try {
localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
    } catch {
    }
  },
  { deep: true },
)

export interface GroupTarget {
  name: string
  icon?: string
  color?: string
}
function mapSnapshotToReleaseMajor(year: number, week: number): [number, number] {
  if (year >= 26) return [year, Math.max(1, Math.ceil(week / 13))]
  if (year <= 11) return [1, 1]
  if (year === 12) return week <= 8 ? [1, 2] : week <= 30 ? [1, 3] : [1, 4]
  if (year === 13) return week <= 12 ? [1, 5] : week <= 26 ? [1, 6] : [1, 7]
  if (year === 14) return [1, 8]
  if (year === 15) return [1, 9]
  if (year === 16) return week <= 21 ? [1, 10] : [1, 11]
  if (year === 17) return week <= 18 ? [1, 12] : [1, 13]
  if (year === 18) return week <= 33 ? [1, 13] : [1, 14]
  if (year === 19) return week <= 14 ? [1, 14] : [1, 15]
  if (year === 20) return week <= 30 ? [1, 16] : [1, 17]
  if (year === 21) return week <= 20 ? [1, 17] : [1, 18]
  if (year === 22) return week <= 7 ? [1, 18] : [1, 19]
  if (year === 23) return week <= 7 ? [1, 19] : [1, 20]
  if (year === 24) return week <= 14 ? [1, 20] : [1, 21]
  return [1, 21]
}

interface ParsedMinecraftVersion {
  major: number
  minor: number
  patch: number
  /** 4 = wildcard (.x), 3 = final release, 2 = rc, 1 = pre-release, 0 = snapshot/other */
  stage: number
  preNum: number
  snapshotWeek: number
  snapshotRev: number
  known: boolean
}

function parseMinecraftVersion(raw: string): ParsedMinecraftVersion {
  const v = raw.trim().toLowerCase()
  if (!v || v === 'unknown') {
    return { major: -1, minor: -1, patch: -1, stage: -1, preNum: 0, snapshotWeek: 0, snapshotRev: 0, known: false }
  }

  // Weekly snapshot e.g. 24w14a or 13w01a
  const snapMatch = v.match(/^(\d{2})w(\d{2})([a-z])?$/)
  if (snapMatch) {
    const year = Number(snapMatch[1])
    const week = Number(snapMatch[2])
    const rev = snapMatch[3] ? snapMatch[3].charCodeAt(0) - 96 : 0
    const [major, minor] = mapSnapshotToReleaseMajor(year, week)
    return {
      major,
      minor,
      patch: 0,
      stage: 0,
      preNum: 0,
      snapshotWeek: year * 100 + week,
      snapshotRev: rev,
      known: true,
    }
  }

  // Group wildcard e.g. 1.21.x or 26.1.x
  const groupMatch = v.match(/^(\d+)\.(\d+)\.x$/)
  if (groupMatch) {
    return {
      major: Number(groupMatch[1]),
      minor: Number(groupMatch[2]),
      patch: Number.MAX_SAFE_INTEGER,
      stage: 4,
      preNum: 0,
      snapshotWeek: 0,
      snapshotRev: 0,
      known: true,
    }
  }

  // Standard release / pre-release / rc / snapshot e.g. 1.21.1, 1.21.1-pre1, 1.21.1-rc1, 1.21.1 Pre-Release 2, 26.1-snapshot-1
  const relMatch = v.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:[- ]?(pre(?:-?release)?|rc|release candidate|snapshot)[- ]?(\d+)?)?(.*)$/)
  if (relMatch) {
    const major = Number(relMatch[1])
    const minor = Number(relMatch[2])
    const patch = relMatch[3] !== undefined ? Number(relMatch[3]) : 0
    const tag = relMatch[4]
    const tagNum = relMatch[5] !== undefined ? Number(relMatch[5]) : 1
    const rest = (relMatch[6] || '').trim()

    let stage = 3
    let preNum = 0
    if (tag) {
      if (tag.startsWith('rc') || tag.startsWith('release candidate')) {
        stage = 2
        preNum = tagNum
      } else if (tag.startsWith('pre')) {
        stage = 1
        preNum = tagNum
      } else {
        stage = 0
        preNum = tagNum
      }
    } else if (rest) {
      stage = 0
    }

    return {
      major,
      minor,
      patch,
      stage,
      preNum,
      snapshotWeek: 0,
      snapshotRev: 0,
      known: true,
    }
  }

  const nums = (v.match(/\d+/g) || []).map(Number)
  if (nums.length > 0) {
    return {
      major: nums[0] ?? 0,
      minor: nums[1] ?? 0,
      patch: nums[2] ?? 0,
      stage: 0,
      preNum: nums[3] ?? 0,
      snapshotWeek: 0,
      snapshotRev: 0,
      known: true,
    }
  }

  return { major: -1, minor: -1, patch: -1, stage: -1, preNum: 0, snapshotWeek: 0, snapshotRev: 0, known: false }
}

export function classifyInstance(instance: Instance, strategy: AutoGroupStrategy): GroupTarget {
  // МЯЯЯЯЯЯЯУ
  if (instance.edition === 'bedrock') {
    return {
      name: 'Bedrock',
      icon: 'xmcl:bedrock',
      color: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    }
  }
  if (strategy === 'modloader') {
    const rt = instance.runtime
    if (rt.neoForged) {
      return {
        name: 'NeoForge',
        icon: 'xmcl:neoForged',
        color: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
      }
    }
    if (rt.forge) {
      return {
        name: 'Forge',
        icon: 'xmcl:forge',
        color: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
      }
    }
    if (rt.fabricLoader) {
      return {
        name: 'Fabric',
        icon: 'xmcl:fabric',
        color: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
      }
    }
    if (rt.quiltLoader) {
      return {
        name: 'Quilt',
        icon: 'xmcl:quilt',
        color: 'linear-gradient(135deg, #A855F7 0%, #8B5CF6 100%)',
      }
    }
    if (rt.optifine) {
      return {
        name: 'OptiFine',
        icon: 'xmcl:optifine',
        color: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      }
    }
    return {
      name: 'Vanilla',
      icon: 'xmcl:minecraft',
      color: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    }
  }

  if (strategy === 'version') {
    const mc = (instance.runtime.minecraft || '').trim()
    const parsed = parseMinecraftVersion(mc)
    const major = parsed.known && parsed.major >= 0 ? `${parsed.major}.${parsed.minor}` : (mc || 'Unknown')
    const groupName = parsed.known && parsed.major >= 0 ? `${parsed.major}.${parsed.minor}.x` : (mc || 'Unknown')
    const versionColors: Record<string, string> = {
      // ОСЬ ТУТ Я ХУЯРИВ ГРАДІЄНТ НА УГАД...Честно у мене смак не такий крутий як у деяких :3
      '1.21': 'linear-gradient(135deg, #F97316 0%, #06B6D4 100%)',
      '1.20': 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
      '1.19': 'linear-gradient(135deg, #0D9488 0%, #0284C7 100%)',
      '1.18': 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
      '1.17': 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
      '1.16': 'linear-gradient(135deg, #475569 0%, #991B1B 100%)',
      '1.12': 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
      '1.7': 'linear-gradient(135deg, #10B981 0%, #22C55E 100%)',
    }
    return {
      name: groupName,
      icon: 'xmcl:minecraft',
      color: versionColors[major] || 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    }
  }
  // strategy === 'source'
  const upstream = instance.upstream
  if (upstream?.type === 'modrinth-modpack') {
    return {
      name: 'Modrinth',
      icon: 'xmcl:modrinth',
      color: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
    }
  }
  if (upstream?.type === 'curseforge-modpack') {
    return {
      name: 'CurseForge',
      icon: 'xmcl:curseforge',
      color: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
    }
  }
  if (upstream?.type === 'ftb-modpack') {
    return {
      name: 'Feed The Beast',
      icon: 'xmcl:ftb',
      color: 'linear-gradient(135deg, #F59E0B 0%, #EAB308 100%)',
    }
  }
  if (instance.server) {
    return {
      name: 'Servers',
      icon: 'dns',
      color: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
    }
  }
  return {
    name: 'Custom',
    icon: 'build',
    color: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
  }
}

export function compareMinecraftVersions(v1: string, v2: string): number {
  if (v1 === v2) return 0
  if (v1.toLowerCase() === 'bedrock') return 1
  if (v2.toLowerCase() === 'bedrock') return -1

  const p1 = parseMinecraftVersion(v1)
  const p2 = parseMinecraftVersion(v2)

  if (p1.known !== p2.known) {
    return p1.known ? -1 : 1
  }
  if (!p1.known && !p2.known) {
    return v2.localeCompare(v1)
  }

  if (p1.major !== p2.major) return p2.major - p1.major
  if (p1.minor !== p2.minor) return p2.minor - p1.minor
  if (p1.patch !== p2.patch) return p2.patch - p1.patch
  if (p1.stage !== p2.stage) return p2.stage - p1.stage
  if (p1.preNum !== p2.preNum) return p2.preNum - p1.preNum
  if (p1.snapshotWeek !== p2.snapshotWeek) return p2.snapshotWeek - p1.snapshotWeek
  if (p1.snapshotRev !== p2.snapshotRev) return p2.snapshotRev - p1.snapshotRev

  return v2.localeCompare(v1)
}

function createAutoGroup(target: GroupTarget, strategy: AutoGroupStrategy): InstanceGroupData {
  return {
    id: crypto.getRandomValues(new Uint32Array(2))[0].toString(16),
    name: target.name,
    color: target.color || '',
    icon: target.icon || '',
    instances: [],
    autoGroup: { strategy, bucket: target.name },
  }
}

/** Keep existing placements; only assign paths not already in the saved layout. */
export function reconcileInstanceGroups(
  groups: InstanceOrGroupData[],
  instances: Instance[],
  config: AutoGroupConfig,
): InstanceOrGroupData[] {
  const newGroupData = [] as InstanceOrGroupData[]
  const instanceMap = new Map(instances.map(v => [v.path, v]))
  const existed = new Set(instanceMap.keys())
  for (const item of groups) {
    if (typeof item === 'string') {
      if (existed.has(item)) {
        newGroupData.push(item)
        existed.delete(item)
      }
    } else {
      const newInstances = [] as string[]
      for (const inst of item.instances) {
        if (existed.has(inst)) {
          newInstances.push(inst)
          existed.delete(inst)
        }
      }
      if (newInstances.length > 0) {
        newGroupData.push({ ...item, instances: newInstances })
      }
    }
  }
  const touchedVersionGroups = new Set<InstanceGroupData>()

  const { enabled, strategy } = config
  for (const path of existed) {
    if (!enabled) {
      newGroupData.push(path)
      continue
    }

    const target = classifyInstance(instanceMap.get(path)!, strategy)
    const existingGroup = newGroupData.find((group): group is InstanceGroupData =>
      typeof group !== 'string' && group.autoGroup?.strategy === strategy && group.autoGroup.bucket === target.name,
    )
    const group = existingGroup ?? createAutoGroup(target, strategy)
    group.instances.push(path)
    if (strategy === 'version') {
      touchedVersionGroups.add(group)
    }
    if (!existingGroup) {
      const insertIdx = strategy === 'version'
        ? newGroupData.findIndex(g => typeof g !== 'string' && g.autoGroup?.strategy === strategy &&
          compareMinecraftVersions(target.name, g.autoGroup.bucket) < 0)
        : -1
      if (insertIdx !== -1) {
        newGroupData.splice(insertIdx, 0, group)
      } else {
        const lastGroupIdx = strategy === 'version' ? newGroupData.findLastIndex(g => typeof g !== 'string') : -1
        if (lastGroupIdx !== -1) {
          newGroupData.splice(lastGroupIdx + 1, 0, group)
        } else {
          newGroupData.push(group)
        }
      }
    }
  }

  for (const grp of touchedVersionGroups) {
    grp.instances.sort((a, b) => {
      const instA = instanceMap.get(a)
      const instB = instanceMap.get(b)
      return compareMinecraftVersions(instA?.runtime.minecraft || '', instB?.runtime.minecraft || '')
    })
  }

  return newGroupData
}

export function performAutoGroup(
  allInstancesList: Instance[],
  strategy: AutoGroupStrategy,
  groupsSet: (newGroups: InstanceOrGroupData[]) => void,
) {
  const groupsMap = new Map<string, InstanceGroupData>()
  const instanceMap = new Map<string, Instance>()
  for (const inst of allInstancesList) {
    instanceMap.set(inst.path, inst)
  }

  for (const inst of allInstancesList) {
    const target = classifyInstance(inst, strategy)
    let group = groupsMap.get(target.name)
    if (!group) {
      group = createAutoGroup(target, strategy)
      groupsMap.set(target.name, group)
    }
    group.instances.push(inst.path)
  }

  // Sort instances inside each group
  for (const group of groupsMap.values()) {
    if (strategy === 'version') {
      // Inside version group, sort descending by exact minecraft version (e.g. 1.20.4 before 1.20.1)
      group.instances.sort((a, b) => {
        const instA = instanceMap.get(a)
        const instB = instanceMap.get(b)
        return compareMinecraftVersions(instA?.runtime.minecraft || '', instB?.runtime.minecraft || '')
      })
    }
  }

  const result: InstanceOrGroupData[] = []
  if (strategy === 'version') {
    const bedrockGroup = groupsMap.get('Bedrock')
    groupsMap.delete('Bedrock')
    const versionGroups = Array.from(groupsMap.values())
    versionGroups.sort((a, b) => compareMinecraftVersions(a.name, b.name))
    result.push(...versionGroups)
    if (bedrockGroup) {
      result.push(bedrockGroup)
    }
  } else {
    let orderedKeys: string[] = []
    if (strategy === 'modloader') {
      orderedKeys = ['Forge', 'Fabric', 'NeoForge', 'Quilt', 'Vanilla', 'Bedrock']
    } else if (strategy === 'source') {
      orderedKeys = ['Modrinth', 'CurseForge', 'Feed The Beast', 'Servers', 'Custom', 'Bedrock']
    }
    if (orderedKeys.length > 0) {
      for (const key of orderedKeys) {
        const g = groupsMap.get(key)
        if (g && g.instances.length > 0) {
          result.push(g)
          groupsMap.delete(key)
        }
      }
    }
    result.push(...groupsMap.values())
  }
  groupsSet(result)
}
export function performUngroupAll(
  allInstancesList: Instance[],
  groupsSet: (newGroups: InstanceOrGroupData[]) => void,
) {
  groupsSet(allInstancesList.map(i => i.path))
}

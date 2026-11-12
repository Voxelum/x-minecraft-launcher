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
    const mc = instance.runtime.minecraft || 'Unknown'
    const parts = mc.split('.')
    const major = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : mc
    const groupName = parts.length >= 2 ? `${parts[0]}.${parts[1]}.x` : (mc || 'Unknown')
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

  const p1 = (v1.match(/\d+/g) || []).map(Number)
  const p2 = (v2.match(/\d+/g) || []).map(Number)
  const len = Math.max(p1.length, p2.length)
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] ?? 0
    const num2 = p2[i] ?? 0
    if (num1 !== num2) {
      return num2 - num1
    }
  }
  return v2.localeCompare(v1)
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
      group = {
        id: crypto.getRandomValues(new Uint32Array(2))[0].toString(16),
        name: target.name,
        color: target.color || '',
        icon: target.icon || '',
        instances: [],
      }
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

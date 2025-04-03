import { BuiltinImages } from '@/constant'
import { ReactiveResourceState } from '@/util/ReactiveResourceState'
import { ProjectFile } from '@/util/search'
import { PackMeta } from '@xmcl/resourcepack'
import { GameOptions, InstanceOptionsServiceKey, InstanceResourcePacksServiceKey, isPersistedResource, packFormatVersionRange, Resource } from '@xmcl/runtime-api'
import { computed, InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export interface InstanceResourcePack extends PackMeta.Pack, ProjectFile {
  /**
   * The id in resourcepack array in gamesetting file
   */
  id: string
  /**
   * The resource pack file path
   */
  path: string
  /**
   * The display name of the resource pack
   */
  name: string
  /**
   * The version range of the resource pack
   */
  acceptingRange: string
  /**
   * Icon url
   */
  icon: string
  /**
   * The size of the resource pack
   */
  size?: number
  /**
   * The hash of the resource pack
   */
  hash?: string
}

export const kInstanceResourcePacks: InjectionKey<ReturnType<typeof useInstanceResourcePacks>> = Symbol('InstanceResourcePacks')

function getResourcepackFormat(meta: any) {
  return meta ? meta.format ?? meta.pack_format : 3
}
function getResourcePackItem(resource: Resource, enabled: Set<string>): InstanceResourcePack {
  const p: InstanceResourcePack = {
    path: resource.path,
    version: '',
    enabled: enabled.has(resource.fileName) || enabled.has(`file/${resource.fileName}`),
    name: resource.name,
    id: `file/${resource.fileName.endsWith('.zip') ? resource.fileName : resource.fileName + '.zip'}`,
    pack_format: 0,
    mtime: resource.mtime,
    description: '',
    size: resource.size,
    hash: resource.hash,
    acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata.resourcepack)] ?? '[*]',
    icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
    modrinth: resource.metadata.modrinth,
    curseforge: resource.metadata.curseforge,
  }
  if (resource.metadata.resourcepack) {
    p.description = resource.metadata.resourcepack.description
    p.pack_format = resource.metadata.resourcepack.pack_format
  }
  return p
}

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks(path: Ref<string>, gameOptions: Ref<GameOptions | undefined>) {
  const { watch } = useService(InstanceResourcePacksServiceKey)
  const { state, isValidating, revalidate, error } = useState(() => path.value ? watch(path.value) : undefined, ReactiveResourceState)

  const { t } = useI18n()

  function getResourcePackItemFromGameSettingName(resourcePackName: string): InstanceResourcePack {
    const pack: InstanceResourcePack = {
      path: '',
      acceptingRange: '[*]',
      icon: '',
      name: 'Minecraft',
      version: '',
      size: 0,
      hash: '',
      enabled: true,
      mtime: 0,
      description: '',
      pack_format: 0,
      id: 'vanilla',
    }
    if (resourcePackName !== 'vanilla') {
      pack.path = ''
      pack.name = resourcePackName
      pack.acceptingRange = 'unknown'
      pack.id = resourcePackName.startsWith('file') ? resourcePackName : `file/${resourcePackName}`
    } else {
      pack.icon = BuiltinImages.minecraft
      pack.description = t('resourcepack.defaultDescription')
    }
    return pack
  }

  const result = computed(() => {
    const enabledArray = [...gameOptions.value?.resourcePacks ?? []].reverse()
    const enabledSet = new Set(enabledArray)
    const mapped = [] as InstanceResourcePack[]
    const index: Record<string, InstanceResourcePack> = {}
    const disabled = [] as InstanceResourcePack[]
    for (const r of (state.value?.files || [])) {
      const val = getResourcePackItem(r, enabledSet)
      if (val.enabled) {
        index[val.id] = val
      } else {
        disabled.push(val)
      }
      mapped.push(val)
    }

    /**
     * Enabled pack item.
     * It's the REVERSED version of the resourcePacks array in options.txt (gamesetting).
     * It should be something like ['file/pack.zip', 'vanilla']
     */
    const enabled = [] as InstanceResourcePack[]
    for (const name of enabledArray) {
      if (index[name]) {
        enabled.push(index[name])
      } else {
        enabled.push(getResourcePackItemFromGameSettingName(name))
      }
    }

    return [mapped, disabled, enabled] as const
  })

  const enabled = computed(() => result.value[2])
  const disabled = computed(() => result.value[1])
  const files = computed(() => result.value[0])
  const enabledSet = computed(() => new Set(result.value[2].map(e => e.id)))

  const { editGameSetting } = useService(InstanceOptionsServiceKey)

  function enable(pack: (InstanceResourcePack | string)[]) {
    const newEnabled = [...pack.map(e => typeof e === 'string' ? e : e.id), ...enabled.value.map(e => e.id)]
    return editGameSetting({
      instancePath: path.value,
      resourcePacks: newEnabled.reverse(),
    })
  }
  function insert(index: number, inserTo: number) {
    const newEnabled = [...enabled.value]
    const [item] = newEnabled.splice(index, 1)
    newEnabled.splice(inserTo, 0, item)
    return editGameSetting({
      instancePath: path.value,
      resourcePacks: newEnabled.map(n => n.id).reverse(),
    })
  }
  function disable(packs: Array<InstanceResourcePack>) {
    const removed = packs.map(p => p.id)
    const newEnabled = enabled.value.filter(e => !removed.includes(e.id))
    return editGameSetting({
      instancePath: path.value,
      resourcePacks: newEnabled.map(n => n.id).reverse(),
    })
  }

  return {
    enabledSet,
    enabled,
    disabled,
    files,
    insert,
    enable,
    disable,
    refreshing: isValidating,
  }
}

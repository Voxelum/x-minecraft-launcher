import { PackMeta } from '@xmcl/resourcepack'
import { GameOptions, InstanceOptionsServiceKey, InstanceResourcePacksServiceKey, isPersistedResource, packFormatVersionRange, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { computed, InjectionKey, Ref } from 'vue'

import { useDomainResources } from './resources'
import { useService } from './service'
import { ProjectFile } from '@/util/search'
import { BuiltinImages } from '@/constant'

export interface InstanceResourcePack extends PackMeta.Pack, ProjectFile {
  /**
   * The resource pack file path
   */
  path: string
  /**
   * The display name of the resource pack
   */
  name: string
  /**
   * The id in resourcepack array in gamesetting file
   */
  id: string
  /**
   * The url of the resourcepack
   */
  url: string[]
  /**
   * The version range of the resource pack
   */
  acceptingRange: string
  /**
   * Icon url
   */
  icon: string
  /**
   * The tags of the resource pack
   */
  tags: string[]
  /**
   * The resource associate with the resourcepack item.
   * If it's undefined. Then this resource cannot be found.
   */
  resource: Resource
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
    url: resource.uris,
    pack_format: 0,
    description: '',
    acceptingRange: packFormatVersionRange[getResourcepackFormat(resource.metadata.resourcepack)] ?? '[*]',
    icon: isPersistedResource(resource) ? resource.icons?.[0] ?? '' : '',
    tags: resource.tags,
    modrinth: resource.metadata.modrinth,
    curseforge: resource.metadata.curseforge,
    resource,
  }
  if (resource.metadata.resourcepack) {
    p.description = resource.metadata.resourcepack.description
    p.pack_format = resource.metadata.resourcepack.pack_format
  }
  return p
}
const EMPTY_RESOURCE: Resource = ({
  ino: 0,
  path: '',
  metadata: {},
  tags: [],
  domain: ResourceDomain.ResourcePacks,
  fileName: '',
  fileType: '',
  size: 0,
  version: 0,
  hash: '',
  name: '',
  uris: [],
  mtime: 0,
})

/**
 * The hook return a reactive resource pack array.
 */
export function useInstanceResourcePacks(path: Ref<string>, gameOptions: Ref<GameOptions | undefined>) {
  const { link, scan } = useService(InstanceResourcePacksServiceKey)
  const local = ref([] as Resource[])
  async function mount(path: string) {
    local.value = []
    if (!path) return
    const linked = await link(path)
    if (!linked) {
      const scanned = await scan(path)
      local.value = scanned
    }
  }
  watch(path, mount, { immediate: true })

  const { resources, refresh, refreshing } = useDomainResources(ResourceDomain.ResourcePacks)
  const { t } = useI18n()

  function getResourcePackItemFromGameSettingName(resourcePackName: string): InstanceResourcePack {
    const pack: InstanceResourcePack = {
      path: '',
      acceptingRange: '[*]',
      icon: '',
      name: 'Minecraft',
      version: '',
      enabled: true,
      description: '',
      pack_format: 0,
      id: 'vanilla',
      url: [],
      tags: [],
      resource: markRaw({ ...EMPTY_RESOURCE, name: 'Vanilla', path: 'vanilla' }),
    }
    if (resourcePackName !== 'vanilla') {
      pack.path = ''
      pack.name = resourcePackName
      pack.acceptingRange = 'unknown'
      pack.id = resourcePackName.startsWith('file') ? resourcePackName : `file/${resourcePackName}`
      pack.resource = markRaw({ ...EMPTY_RESOURCE, name: resourcePackName, path: `file/${resourcePackName}` })
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
    for (const r of resources.value.concat(local.value)) {
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
    refreshing,
  }
}

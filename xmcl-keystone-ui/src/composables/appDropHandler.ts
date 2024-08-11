import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { ImportServiceKey, isPersistedResource, Resource, ResourceDomain, ResourceServiceKey, UserServiceKey, YggdrasilServiceKey } from '@xmcl/runtime-api'
import { kDropHandler } from './dropHandler'
import { useService } from './service'
import { kInstance } from './instance'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceTemplates'

export interface DropItem {
  id: string
  enabled: boolean

  // Used for ui display
  status: 'loading' | 'idle' | 'failed' | 'saved'
  icon: string
  title: string
  description: string
  type: string[]

  // Used for import
  uris: string[]
  resource: Resource | undefined
}

/**
 * The common drop handler for app. This is the default behavior of dropping item to app.
 */
export function useAppDropHandler() {
  const loading = ref(false)
  const active = ref(false)
  const items = ref([] as DropItem[])
  const { t } = useI18n()

  const { registerHandler, dragover } = injection(kDropHandler)
  const { path } = injection(kInstance)
  const { show } = useDialog(AddInstanceDialogKey)

  registerHandler(() => {
    active.value = true
  }, async (dataTransfer) => {
    const promises = [] as Promise<any>[]
    if (dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; ++i) {
        const item = dataTransfer.items[i]
        if (item.kind === 'string') {
          const content = await new Promise<string>((resolve) => item.getAsString(resolve))
          if (content.startsWith('authlib-injector:yggdrasil-server:')) {
            promises.push(onAuthServiceDropped(content))
          } else if (content.startsWith('https://github.com/') || content.startsWith('https://gitlab.com')) {
            promises.push(onGitURLDropped(content))
          }
        }
      }
    }

    if (dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files.item(i)!
        if (items.value.every(p => p.id !== file.path)) {
          promises.push(onFileDropped(file))
        }
      }
    }
    dragover.value = false

    await Promise.all(promises).catch(() => {})
    if (items.value.length === 0) {
      cancel()
    }
  }, () => {
    if (items.value.length === 0) cancel()
  })
  const { resolveResources, importResources, install } = useService(ResourceServiceKey)
  const { addYggdrasilService } = useService(YggdrasilServiceKey)
  const { previewUrl } = useService(ImportServiceKey)

  const iconMap: Record<string, string> = {
    mods: '$vuetify.icons.package',
    unclassified: 'question_mark',
    resourcepacks: '$vuetify.icons.zip',
    shaderpacks: '$vuetify.icons.zip',
    modpacks: '$vuetify.icons.package',
    saves: '$vuetify.icons.zip',
  }

  function getDescription(rsize: number | undefined, url: string) {
    if (!rsize) {
      return url
    }
    const size = getExpectedSize(rsize, 'B')
    return `${size} ${url}`
  }

  function getTypes(resource: Resource | undefined) {
    const types = [] as string[]
    if (!resource || !resource.metadata) {
      return [t('universalDrop.unknownResource')]
    }
    for (const [key, value] of Object.entries(resource.metadata)) {
      if (!value || Object.entries(value).length === 0) continue
      switch (key) {
        case 'forge':
          types.push('Forge Mod')
          break
        case 'fabric':
          types.push('Fabric Mod')
          break
        case 'resourcepack':
          types.push(t('resourcepack.name', 1))
          break
        case 'mcbbs-modpack':
          types.push(t('modpack.name', 1) + ' (MCBBS)')
          break
        case 'modpack':
          types.push(t('modpack.name', 1))
          break
        case 'save':
          types.push(t('save.name', 1))
          break
        case 'curseforge-modpack':
          types.push(t('modpack.name', 1) + ' (Curseforge)')
          break
        case 'modrinth-modpack':
          types.push(t('modrinth.projectType.modpack') + ' (Modrinth)')
          break
        case 'shaderpack':
          types.push(t('shaderPack.name'))
          break
      }
    }
    return types
  }

  function getIcon(resource: Resource | undefined) {
    if (resource?.metadata['curseforge-modpack']) {
      return '$vuetify.icons.curseforge'
    }
    if (resource?.metadata['modrinth-modpack']) {
      return '$vuetify.icons.modrinth'
    }
    if (resource?.metadata['mcbbs-modpack']) {
      return '$vuetify.icons.package'
    }
    if (resource?.metadata.forge) {
      return '$vuetify.icons.forge'
    }
    if (resource?.metadata.fabric) {
      return '$vuetify.icons.fabric'
    }
    return resource ? iconMap[resource.domain] ?? 'question_mark' : 'question_mark'
  }

  async function handleImport(item: DropItem, shouldHandleModpack: boolean) {
    item.status = 'loading'
    if (item.resource) {
      let resource = item.resource
      const isModpack = !!resource.metadata['modrinth-modpack'] || !!resource.metadata['curseforge-modpack'] || !!resource.metadata['mcbbs-modpack'] ||
       !!resource.metadata['mmc-modpack']

      if (!isPersistedResource(item.resource) && !isModpack) {
        try {
          [resource] = await importResources([{
            path: resource.path,
            uris: item.uris,
          }])
          item.type = getTypes(resource)
          item.icon = getIcon(resource)
          item.resource = resource
          item.status = 'saved'
        } catch (e) {
          console.log(`Failed to import resource ${resource.path}`)
          console.log(e)
          item.status = 'failed'
        }
      }

      if (isModpack) {
        if (shouldHandleModpack) {
          show({ type: 'resource', resource: item.resource })
        }
      } else {
        // Install the resources
        install({
          instancePath: path.value,
          resource,
        })
      }
    } else if (item.type[0] === 'Yggdrasil') {
      try {
        await addYggdrasilService(item.id)
        item.status = 'saved'
      } catch (e) {
        console.log(e)
        item.status = 'failed'
      }
    }
  }

  async function onImport(items: DropItem[]) {
    await Promise.all(items.map((item) => handleImport(item, items.length === 1)))
    cancel()
  }

  async function onFileDropped(file: File) {
    const object: DropItem = reactive({
      enabled: true,
      id: file.path,

      title: file.name,
      description: getDescription(file.size, file.path),
      icon: 'question_mark',
      type: [],
      status: 'loading',
      uris: [],
      resource: undefined,
    })
    items.value.push(object)
    try {
      const result = await resolveResources([{ path: file.path }]).finally(() => { loading.value = false })
      object.resource = result[0]
      object.type = getTypes(result[0])
      object.icon = getIcon(result[0])
      object.status = isPersistedResource(result[0]) && result[0].domain !== ResourceDomain.Unclassified ? 'saved' : 'idle'
    } catch (e) {
      console.log(e)
      object.status = 'failed'
    }
  }

  async function onAuthServiceDropped(url: string) {
    const existed = items.value.find(v => v.id === url)
    if (!existed) {
      const object: DropItem = reactive({
        enabled: true,
        id: url,

        type: ['Yggdrasil'],
        icon: 'link',
        title: computed(() => t('userService.add')),
        description: url,
        status: 'idle' as const,

        uris: [url],
        resource: undefined,
      })
      items.value.push(object)
    }
  }

  async function onGitURLDropped(url: string) {
    const existed = items.value.find(v => v.id === url)
    const object: DropItem = existed ?? reactive({
      enabled: false,
      id: url,

      type: getTypes(undefined),
      icon: getIcon(undefined),
      title: basename(new URL(url).pathname),
      description: getDescription(undefined, url),
      status: 'loading' as const,

      uris: [url],
      resource: undefined,
    })

    if (!existed || existed.status === 'failed') {
      const promise = previewUrl({ url })
      promise.then((result) => {
        object.resource = result
        if (result) {
          object.title = result.name
          object.type = getTypes(result)
          object.icon = getIcon(result)

          object.status = 'idle'
          object.uris = result.uris
        } else {
          object.status = 'failed'
        }
      }, () => {
        object.status = 'failed'
      })
    }

    if (!existed) {
      items.value.push(object)
    }
  }

  function remove(file: DropItem) {
    items.value = items.value.filter((p) => p.id !== file.id)
    if (items.value.length === 0) {
      cancel()
    }
  }

  function cancel() {
    dragover.value = false
    active.value = false
    items.value = []
  }

  return {
    active,
    previews: items,
    onImport,
    previewAuthService: onAuthServiceDropped,
    previewGitUrl: onGitURLDropped,
    remove,
    dragover,
    loading,
    cancel,
  }
}

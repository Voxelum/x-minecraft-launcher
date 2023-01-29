import { getExpectedSize } from '@/util/size'
import { BaseServiceKey, ImportServiceKey, isPersistedResource, Resource, ResourceDomain, ResourceServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { basename } from '../util/basename'
import { useService } from './service'

export interface PreviewItem {
  id: string
  enabled: boolean

  // Used for ui display
  status: 'loading' | 'idle' | 'failed' | 'saved'
  icon: string
  title: string
  description: string
  type: string

  // Used for import
  uris: string[]
  resource: Resource | undefined
}

export const kDropService: InjectionKey<ReturnType<typeof useDropService>> = Symbol('DropService')

export function useDropService() {
  const dragover = ref(false)
  const active = ref(false)
  const loading = ref(false)
  const previews = ref([] as PreviewItem[])
  const { resolveResources } = useService(ResourceServiceKey)
  const { addYggdrasilAccountSystem } = useService(UserServiceKey)
  const { previewUrl, importFile } = useService(ImportServiceKey)
  const suppressed = ref(false)
  const { t } = useI18n()

  const iconMap: Record<string, string> = {
    forge: '$vuetify.icons.package',
    fabric: '$vuetify.icons.fabric',
    unclassified: 'question_mark',
    resourcepack: '$vuetify.icons.zip',
    shaderpack: '$vuetify.icons.zip',
    'curseforge-modpack': '$vuetify.icons.curseforge',
    modpack: '$vuetify.icons.package',
    'mcbbs-modpack': '$vuetify.icons.package',
    save: '$vuetify.icons.zip',
    'modrinth-modpack': '$vuetify.icons.modrinth',
  }

  function getIcon(resource: Resource | undefined) {
    return resource ? iconMap[resource.domain] ?? 'question_mark' : 'question_mark'
  }

  function getDescription(r: Resource | undefined, url: string) {
    if (!r) {
      return url
    }
    const size = getExpectedSize(r.size, 'B')
    return `${size} ${url}`
  }

  function getType(resource: Resource | undefined) {
    const types = [] as string[]
    if (!resource) {
      return t('universalDrop.unknownResource')
    }
    for (const key of Object.keys(resource.metadata)) {
      switch (key) {
        case 'forge':
          types.push('Forge Mod')
          break
        case 'fabric':
          types.push('Fabric Mod')
          break
        case 'resourcepack':
          types.push(t('resourcepack.name', 0))
          break
        case 'mcbbs-modpack':
        case 'modpack':
          types.push(t('modpack.name', 0))
          break
        case 'save':
          types.push(t('save.name', 0))
          break
        case 'curseforge-modpack':
          types.push(t('modpack.name', 0))
          break
        case 'modrinth-modpack':
          types.push(t('modrinth.projectType.modpack'))
          break
        case 'shaderpack':
          types.push(t('shaderPack.name'))
          break
      }
    }
    return types.join(' | ')
  }

  async function onImport(previews: PreviewItem[]) {
    const promises = [] as Promise<any>[]
    for (const preview of previews) {
      preview.status = 'loading'
      if (preview.resource) {
        const res = preview.resource
        const promise = importFile({
          resource: {
            name: preview.title,
            path: res.path,
            uris: preview.uris,
          },
          modpackPolicy: {
            import: true,
          },
        }).then(() => {
          preview.type = getType(res)
          preview.icon = getIcon(res)
          preview.status = 'saved'
        }, (e) => {
          console.log(`Failed to import resource ${res.path}`)
          console.log(e)
          preview.status = 'failed'
        })
        promises.push(promise)
      } else if (preview.type === 'Yggdrasil') {
        addYggdrasilAccountSystem(preview.id).then(() => {
          preview.status = 'saved'
        }, (e) => {
          console.log(e)
          preview.status = 'failed'
        })
      }
    }
    Promise.all(promises).then(() => cancel())
  }

  async function previewAuthService(url: string) {
    const existed = previews.value.find(v => v.id === url)
    if (!existed) {
      const object: PreviewItem = reactive({
        enabled: true,
        id: url,

        type: 'Yggdrasil',
        icon: 'link',
        title: computed(() => t('userService.add')),
        description: url,
        status: 'idle' as const,

        uris: [url],
        resource: undefined,
      })
      previews.value.push(object)
    }
  }

  async function previewGitUrl(url: string) {
    const existed = previews.value.find(v => v.id === url)
    const object: PreviewItem = existed ?? reactive({
      enabled: false,
      id: url,

      type: getType(undefined),
      icon: getIcon(undefined),
      title: basename(new URL(url).pathname),
      description: getDescription(undefined, url),
      status: 'loading' as const,

      uris: [url],
      resource: undefined,
    })

    if (!existed || existed.status === 'failed') {
      const promise = previewUrl({ url: url })
      promise.then((result) => {
        object.resource = result
        if (result) {
          object.title = result.name
          object.type = getType(result)
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
      previews.value.push(object)
    }
  }

  async function onDrop(event: DragEvent) {
    const dataTransfer = event.dataTransfer!

    console.log(dataTransfer.types[0])
    console.log(dataTransfer.dropEffect)
    console.log(dataTransfer.getData('text/html'))
    console.log(dataTransfer.getData('text/plain'))

    if (dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; ++i) {
        const item = dataTransfer.items[i]
        if (item.kind === 'string') {
          const content = await new Promise<string>((resolve) => item.getAsString(resolve))
          if (content.startsWith('authlib-injector:yggdrasil-server:')) {
            previewAuthService(content)
          } else if (content.startsWith('https://github.com/') || content.startsWith('https://gitlab.com')) {
            previewGitUrl(content)
          }
        }
      }
    }

    const files = [] as Array<File>
    if (dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files.item(i)!
        if (previews.value.every(p => p.id !== file.path)) {
          files.push(file)
        }
      }
    }
    loading.value = true
    const result = await resolveResources(files.map(f => ({ path: f.path }))).finally(() => { loading.value = false })
    for (let i = 0; i < result.length; i++) {
      const r = result[i]
      const f = files[i]
      previews.value.push({
        enabled: isPersistedResource(r),
        id: f.path,

        title: f.name,
        description: getDescription(r, f.path),
        icon: getIcon(r),
        type: getType(r),
        status: isPersistedResource(r) && r.domain !== ResourceDomain.Unclassified ? 'saved' : 'idle',

        uris: [],
        resource: r,
      })
    }
    dragover.value = false
    if (previews.value.length === 0) {
      cancel()
    }
  }
  function remove(file: PreviewItem) {
    previews.value = previews.value.filter((p) => p.id !== file.id)
    if (previews.value.length === 0) {
      cancel()
    }
  }
  function cancel() {
    dragover.value = false
    active.value = false
    previews.value = []
  }
  document.addEventListener('dragleave', (e) => {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'all') {
      if (!dragover.value || previews.value.length > 0) {
        dragover.value = false
      } else {
        cancel()
      }
    }
  })
  document.addEventListener('drop', (e) => {
    if (!suppressed.value) {
      onDrop(e)
    }
  })
  document.addEventListener('dragover', (e) => {
    if ((e as any).fromElement === null) {
      if (e.dataTransfer!.effectAllowed === 'all') {
        e.preventDefault()
      }
    }
  })
  document.addEventListener('dragenter', (e) => {
    if ((e as any).fromElement === null) {
      if (e.dataTransfer!.effectAllowed === 'all') {
        if (!suppressed.value) {
          active.value = true
          dragover.value = true
        }
      }
    }
    e.dataTransfer!.dropEffect = 'copy'
  })

  return {
    dragover,
    loading,
    active,
    previews,
    suppressed,
    onImport,
    remove,
    cancel,
  }
}

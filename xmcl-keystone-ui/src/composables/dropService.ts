import { InjectionKey, Ref } from '@vue/composition-api'
import { BaseServiceKey, ImportServiceKey, isPersistedResource, Resource, ResourceDomain, ResourceServiceKey, ResourceType } from '@xmcl/runtime-api'
import { basename } from '../util/basename'
import { useService } from './service'

export interface FilePreview {
  enabled: boolean
  status: 'loading' | 'idle' | 'failed' | 'saved'
  name: string
  path: string
  url?: string[]
  size: number
  result: Resource | undefined
}

export interface DropService {
  loading: Ref<boolean>
  active: Ref<boolean>
  dragover: Ref<boolean>
  previews: Ref<FilePreview[]>
  remove(preview: FilePreview): void
  cancel(): void
}

export const DropServiceInjectionKey: InjectionKey<DropService> = Symbol('DropService')

export function useDropService() {
  const dragover = ref(false)
  const active = ref(false)
  const loading = ref(false)
  const previews = ref([] as FilePreview[])
  const { resolveResources } = useService(ResourceServiceKey)
  const { handleUrl } = useService(BaseServiceKey)
  const { previewUrl } = useService(ImportServiceKey)
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
          const content = await new Promise<string>((resolve) => {
            item.getAsString((content) => {
              resolve(content)
            })
          })
          if (content.startsWith('authlib-injector:yggdrasil-server:')) {
            handleUrl(content)
          } else if (content.startsWith('https://github.com/') || content.startsWith('https://gitlab.com')) {
            const existed = previews.value.find(v => v.url && v.url.some(v => v === content))
            const object: FilePreview = existed ?? reactive({
              url: [content],
              size: -1,
              path: '',
              name: basename(new URL(content).pathname),
              status: 'loading' as const,
              enabled: false,
              result: undefined,
            })

            if (!existed || existed.status === 'failed') {
              const promise = previewUrl({ url: content })
              promise.then((result) => {
                object.result = result
                if (result) {
                  object.size = result?.size
                  object.name = result.name
                  object.path = result.path
                  object.status = 'idle'
                  object.url = result.uri
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
          break
        }
      }
    }

    const files = [] as Array<File>
    if (dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files.item(i)!
        if (previews.value.every(p => p.path !== file.path)) {
          files.push(file)
        }
      }
    }
    loading.value = true
    const result = await resolveResources({ files: files.map(f => ({ path: f.path })) }).finally(() => { loading.value = false })
    for (let i = 0; i < result.length; i++) {
      const r = result[i][0]
      const f = files[i]
      previews.value.push({
        ...r,
        name: f.name,
        size: r.size,
        result: r,
        enabled: isPersistedResource(r),
        status: isPersistedResource(r) && r.domain !== ResourceDomain.Unknown ? 'saved' : 'idle',
      })
    }
    dragover.value = false
    if (previews.value.length === 0) {
      cancel()
    }
  }
  function remove(file: FilePreview) {
    previews.value = previews.value.filter((p) => p.path !== file.path)
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
    onDrop(e)
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
        active.value = true
        dragover.value = true
      }
    }
    e.dataTransfer!.dropEffect = 'copy'
  })

  provide(DropServiceInjectionKey, {
    loading,
    active,
    previews,
    remove,
    cancel,
    dragover,
  })
  return {
    loading,
    active,
    previews,
    remove,
    cancel,
  }
}

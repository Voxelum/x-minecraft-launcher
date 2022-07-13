import { InjectionKey } from '@vue/composition-api'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { useInstance } from './instance'
import { useService } from '/@/composables'

export const InstanceEditInjectionKey: InjectionKey<ReturnType<typeof useInstanceEdit>> = Symbol('InstanceEdit')

export function useInstanceEdit() {
  const { state, editInstance: edit } = useService(InstanceServiceKey)
  const instance = computed(() => state.instances.find(s => s.path === state.path)!)

  const data = reactive({
    hideLauncher: false,
    showLog: false,
    name: instance.value?.name ?? '',

    host: '', // mc.hypixel.com
    port: '', // 25565

    author: '',
    description: '',
    url: '',
    fileServerApi: '',

    vmOptions: '',
    mcOptions: '',
    maxMemory: instance.value?.maxMemory > 0 ? instance.value.maxMemory : 0,
    minMemory: instance.value?.minMemory > 0 ? instance.value.minMemory : 0,

    fastLaunch: false,
    assignMemory: true as true | 'auto' | false,

    javaPath: '',

    loading: true,
  })

  async function save() {
    const payload = {
      name: data.name,
      hideLauncher: data.hideLauncher,
      url: data.url,
      showLog: data.showLog,
      fileApi: data.fileServerApi || '',
      minMemory: data.minMemory,
      maxMemory: data.maxMemory,
      vmOptions: data.vmOptions.split(' ').filter(v => v.length !== 0),
      mcOptions: data.mcOptions.split(' ').filter(v => v.length !== 0),
      assignMemory: data.assignMemory,
      fastLaunch: data.fastLaunch,
      java: data.javaPath,
    }
    if (!instance.value.server) {
      await edit({
        ...payload,
        author: data.author,
        description: data.description,
      })
    } else {
      await edit({
        ...payload,
        server: {
          host: data.host,
          port: Number.parseInt(data.port, 10),
        },
      })
    }
  }
  function load() {
    data.loading = false
    const current = instance.value
    if (current) {
      data.name = current.name
      data.hideLauncher = current.hideLauncher
      data.url = current.url
      data.showLog = current.showLog
      data.author = current.author
      data.fileServerApi = current.fileApi || ''
      data.description = current.description || ''

      if (current.server) {
        data.host = current.server.host
        data.port = current.server.port?.toString() || ''
      }

      data.maxMemory = current.maxMemory <= 0 ? 0 : current.maxMemory
      data.minMemory = current.minMemory <= 0 ? 0 : current.minMemory
      data.vmOptions = current.vmOptions.join(' ')
      data.mcOptions = current.mcOptions.join(' ')
      data.javaPath = current.java
      data.assignMemory = current.assignMemory
      data.fastLaunch = current.fastLaunch
    }
  }

  return {
    data,
    save,
    load,
  }
}

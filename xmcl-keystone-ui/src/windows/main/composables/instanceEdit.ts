import { InjectionKey } from '@vue/composition-api'
import { useInstance } from './instance'

export const InstanceEditInjectionKey: InjectionKey<ReturnType<typeof useInstanceEdit>> = Symbol('InstanceEdit')

export function useInstanceEdit() {
  const data = reactive({
    hideLauncher: false,
    showLog: false,
    name: '',

    host: '', // mc.hypixel.com
    port: '', // 25565

    author: '',
    description: '',
    url: '',
    fileServerApi: '',

    vmOptions: '',
    mcOptions: '',
    maxMemory: undefined as number | undefined,
    minMemory: undefined as number | undefined,
    memoryRange: [256, 10240],
    memoryRule: [(v: any) => Number.isInteger(v)],

    javaPath: '',
  })

  const {
    isServer,
    showLog,
    hideLauncher,
    name,
    author,
    url,
    description,
    server,
    fileApi,
    maxMemory,
    minMemory,
    vmOptions,
    mcOptions,
    java,
    editInstance: edit,
  } = useInstance()

  async function save() {
    const payload = {
      name: data.name,
      hideLauncher: data.hideLauncher,
      url: data.url,
      showLog: data.showLog,
      fileApi: data.fileServerApi || '',
      minMemory: data.minMemory ? Number.parseInt(data.minMemory as any, 10) : undefined,
      maxMemory: data.maxMemory ? Number.parseInt(data.maxMemory as any, 10) : undefined,
      vmOptions: data.vmOptions.split(' ').filter(v => v.length !== 0),
      mcOptions: data.mcOptions.split(' ').filter(v => v.length !== 0),
      java: data.javaPath,
    }
    if (!isServer.value) {
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
    data.name = name.value
    data.hideLauncher = hideLauncher.value
    data.url = url.value
    data.showLog = showLog.value
    data.author = author.value
    data.fileServerApi = fileApi.value || ''
    data.description = description?.value || ''

    if (server.value) {
      data.host = server.value.host
      data.port = server.value.port?.toString() || ''
    }

    data.maxMemory = maxMemory.value <= 0 ? undefined : maxMemory.value
    data.minMemory = minMemory.value <= 0 ? undefined : minMemory.value
    data.vmOptions = vmOptions.value.join(' ')
    data.mcOptions = mcOptions.value.join(' ')
    data.javaPath = java.value
  }

  return {
    data,
    save,
    load,
  }
}

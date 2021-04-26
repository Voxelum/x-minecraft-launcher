import { ipcRenderer } from './constant'
import { BaseServiceKey, BaseState } from '/@shared/services/BaseService'
import { CurseForgeServiceKey, CurseforgeState } from '/@shared/services/CurseForgeService'
import { DiagnoseServiceKey, DiagnoseState } from '/@shared/services/DiagnoseService'
import { InstallServiceKey, InstallState } from '/@shared/services/InstallService'
import { GameSettingState, InstanceGameSettingServiceKey } from '/@shared/services/InstanceGameSettingService'
import { InstanceJavaServiceKey, InstanceJavaState } from '/@shared/services/InstanceJavaService'
import { InstanceModsServiceKey, InstanceModsState } from '/@shared/services/InstanceModsService'
import { InstanceResourcePacksServiceKey, InstanceResourcePacksState } from '/@shared/services/InstanceResourcePacksService'
import { InstanceSavesServiceKey, SaveState } from '/@shared/services/InstanceSavesService'
import { InstanceServerInfoServiceKey, ServerInfoState } from '/@shared/services/InstanceServerInfoService'
import { InstanceServiceKey, InstanceState } from '/@shared/services/InstanceService'
import { InstanceVersionServiceKey, InstanceVersionState } from '/@shared/services/InstanceVersionService'
import { JavaServiceKey, JavaState } from '/@shared/services/JavaService'
import { LaunchServiceKey, LaunchState } from '/@shared/services/LaunchService'
import { ResourceServiceKey, ResourceState } from '/@shared/services/ResourceService'
import { ServiceFactory, ServiceKey, State } from '/@shared/services/Service'
import { UserServiceKey, UserState } from '/@shared/services/UserService'
import { VersionServiceKey, VersionState } from '/@shared/services/VersionService'

interface TaskListener {
  (serviceKey: ServiceKey<any>, functionName: string, promise: Promise<any>, sessionId: number, taskId: string): void
}

export interface StateProcessor<T> {
  (service: ServiceKey<T>, state: State): State
}

async function waitSessionEnd(sessionId: number, listener: (task: string) => void) {
  ipcRenderer.on(`session-${sessionId}`, (e, task) => listener(task))
  try {
    const { result, error } = await ipcRenderer.invoke('session', sessionId)
    if (error) {
      if (error.errorMessage) {
        error.toString = () => error.errorMessage
      }
      return Promise.reject(error)
    }
    return result
  } finally {
    ipcRenderer.removeListener(`session-${sessionId}`, listener)
  }
}

function createServiceCallerFunction(serviceKey: ServiceKey<any>, name: string, taskListener: TaskListener) {
  const func = function (payload: any) {
    const promise: Promise<any> = ipcRenderer.invoke('service-call', serviceKey, name, payload).then((sessionId: any) => {
      if (typeof sessionId !== 'number') {
        throw new Error(`Cannot find service call named ${name} in ${serviceKey}`)
      }
      return waitSessionEnd(sessionId, (id) => taskListener(serviceKey, name, promise, sessionId, id))
    })
    return promise
  }
  Object.defineProperty(func, 'name', { value: name, enumerable: false, writable: false, configurable: false })
  return func
}

export function createServiceFactory(createState: StateProcessor<any>, taskListener: TaskListener) {
  function createServiceProxy<T>(serviceKey: ServiceKey<T>, state?: State): T {
    const accessor = state ? createState(serviceKey, state) : undefined
    const cache: Record<string, any> = {
      state: accessor,
    }
    return new Proxy(cache as any, {
      get(_, name) {
        const key = name.toString()
        if (cache[key]) {
          return cache[key]
        }
        const func = createServiceCallerFunction(serviceKey, key, taskListener)
        cache[key] = func
        return func
      },
    })
  }

  const factory = new ServiceFactory(createServiceProxy)

  factory.register(BaseServiceKey, [], () => createServiceProxy(BaseServiceKey.toString(), new BaseState()))
  factory.register(CurseForgeServiceKey, [ResourceServiceKey], (res) => createServiceProxy(CurseForgeServiceKey, new CurseforgeState(res.state)))
  factory.register(DiagnoseServiceKey, [], () => createServiceProxy(DiagnoseServiceKey, new DiagnoseState()))
  factory.register(InstanceGameSettingServiceKey, [], () => createServiceProxy(InstanceGameSettingServiceKey, new GameSettingState()))
  factory.register(InstallServiceKey, [], () => createServiceProxy(InstallServiceKey, new InstallState()))
  factory.register(InstanceModsServiceKey, [], () => createServiceProxy(InstanceModsServiceKey, new InstanceModsState()))
  factory.register(InstanceResourcePacksServiceKey, [], () => createServiceProxy(InstanceResourcePacksServiceKey, new InstanceResourcePacksState()))
  factory.register(InstanceSavesServiceKey, [], () => createServiceProxy(InstanceSavesServiceKey, new SaveState()))
  factory.register(InstanceServerInfoServiceKey, [], () => createServiceProxy(InstanceServerInfoServiceKey, new ServerInfoState()))
  factory.register(InstanceServiceKey, [], () => createServiceProxy(InstanceServiceKey, new InstanceState()))
  factory.register(JavaServiceKey, [], () => createServiceProxy(JavaServiceKey, new JavaState()))
  factory.register(VersionServiceKey, [], () => createServiceProxy(VersionServiceKey, new VersionState()))
  factory.register(InstanceJavaServiceKey, [InstanceServiceKey, JavaServiceKey], (i, j) => createServiceProxy(InstanceJavaServiceKey, new InstanceJavaState(i.state, j.state)))
  factory.register(InstanceVersionServiceKey, [InstanceServiceKey, VersionServiceKey], (i, v) => createServiceProxy(InstanceVersionServiceKey, new InstanceVersionState(i.state, v.state)))
  factory.register(LaunchServiceKey, [], () => createServiceProxy(LaunchServiceKey, new LaunchState()))
  factory.register(ResourceServiceKey, [], () => createServiceProxy(ResourceServiceKey, new ResourceState()))
  factory.register(UserServiceKey, [], () => createServiceProxy(UserServiceKey, new UserState()))

  for (const key of Object.keys(factory.customFactory)) {
    factory.getService(key)
  }

  return factory
}

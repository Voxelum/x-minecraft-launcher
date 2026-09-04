import { ServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, toRaw } from 'vue'
import { injection } from '../util/inject'
import {
  hasRendererActionContext,
  startRendererServiceTrace,
  withRendererAction,
} from '../rendererAction'

export interface ServiceFactory {
  getService<T>(key: ServiceKey<T>): T
}

function sanitizePayload(p: any): any {
  if (!p || typeof p !== 'object') return p
  const raw = toRaw(p)
  if (typeof raw !== 'object' || raw === null) return raw
  try {
    return JSON.parse(JSON.stringify(raw))
  } catch {
    return raw
  }
}

export function getDefaultRendererActionName(service: string, method: string, payload: any[]) {
  if (service === 'LaunchService' && method === 'launch') {
    return 'user_action.minecraft.launch'
  }
  if (service === 'BedrockService') {
    if (method === 'launch') return 'user_action.minecraft.launch'
    if (method === 'install') return 'user_action.instance.install'
  }
  if (
    service === 'VersionInstallService' &&
    (method === 'install' || method === 'installInstance')
  ) {
    const type = payload[0]?.type
    return type === 'repair' || type === 'reinstall'
      ? 'user_action.instance.repair'
      : 'user_action.instance.install'
  }
  if (service === 'InstanceInstallService') {
    if (method === 'resumeInstanceInstall') return 'user_action.instance.repair'
    if (method === 'installInstanceFiles') return 'user_action.instance.install'
  }
  if (
    service === 'ModpackService' &&
    (method === 'installModapckFromMarket' || method === 'importModpack')
  ) {
    return 'user_action.modpack.install'
  }
  if (service === 'InstanceService') {
    if (method === 'createInstance') return 'user_action.instance.create'
    if (method === 'duplicateInstance') return 'user_action.instance.duplicate'
    if (method === 'deleteInstance') return 'user_action.instance.delete'
  }
  if (service === 'RemoteServerService') {
    if (method === 'uploadServer') return 'user_action.remote_server.deploy'
    if (method === 'installService' || method === 'uninstallService')
      return 'user_action.remote_server.configure'
    if (method === 'startService' || method === 'stopService' || method === 'restartService')
      return 'user_action.remote_server.control'
  }
  if (service === 'BaseService' && method === 'migrate') {
    return 'user_action.data_root.migrate'
  }
  if (service === 'BaseService') {
    if (method === 'downloadUpdate') return 'user_action.launcher.update'
    if (method === 'quitAndInstall') return 'user_action.launcher.update_apply'
  }
  if (service === 'InstanceIOService') {
    if (method === 'exportInstanceAsServer') return 'user_action.instance.export'
    if (method === 'importLauncherData') return 'user_action.instance.import'
  }
  if (service === 'InstanceSavesService') {
    if (method === 'deleteSave' || method === 'deleteSaveChunks') {
      return 'user_action.save.delete'
    }
    if (method === 'cloneSave') return 'user_action.save.clone'
    if (method === 'shareSave') return 'user_action.save.share'
    if (method === 'importSave' || method === 'importDatapack') return 'user_action.save.import'
    if (method === 'deleteDatapack') return 'user_action.save.remove_datapack'
    if (method === 'exportSave') return 'user_action.save.export'
  }
  if (service === 'UserService') {
    if (method === 'login' || method === 'loginModrinth') return 'user_action.account.login'
    if (method === 'removeUser') return 'user_action.account.logout'
  }
  if (service === 'PeerServiceKey') {
    if (method === 'shareInstance') return 'user_action.peer.share_instance'
    if (method === 'multiplayerJoinGroup') return 'user_action.peer.join_group'
    if (method === 'multiplayerCreateGroup') return 'user_action.peer.create_group'
  }
  if (
    service === 'InstanceModsService' ||
    service === 'InstanceResourcePacksService' ||
    service === 'InstanceShaderPacksService'
  ) {
    if (method === 'install' || method === 'installFromMarket') {
      return 'user_action.resource.install'
    }
    if (method === 'uninstall') return 'user_action.resource.remove'
    if (method === 'enable') return 'user_action.resource.enable'
    if (method === 'disable') return 'user_action.resource.disable'
  }
  if (service === 'ModpackService') {
    if (method === 'exportModpack') return 'user_action.modpack.export'
    if (
      method === 'createAndBindModrinthProject' ||
      method === 'updateBoundModrinthProject' ||
      method === 'publishModrinth' ||
      method === 'submitModrinthVersion'
    ) {
      return 'user_action.modpack.publish'
    }
  }
  return undefined
}

export class ServiceFactoryImpl implements ServiceFactory {
  private cache: Record<string, any | undefined> = {}

  constructor() {}

  private createProxy<T>(serviceKey: ServiceKey<T>) {
    const channel = serviceChannels.open(serviceKey)

    const service: Record<string, any> = new Proxy(
      {
        on: channel.on,
        once: channel.once,
        removeListener: channel.removeListener,
      } as any,
      {
        get(o, key, r) {
          if (key in o) return o[key]
          const f = (...payload: any[]) => {
            const sanitizedPayload = payload.map(sanitizePayload)
            const invoke = () => {
              const trace = startRendererServiceTrace()
              return channel.callWithTrace(trace.context, key as any, ...(sanitizedPayload as any))
            }
            const actionName = getDefaultRendererActionName(
              serviceKey.toString(),
              key.toString(),
              sanitizedPayload,
            )
            return actionName && !hasRendererActionContext()
              ? withRendererAction(actionName, async (action) => {
                  const result = await action.run(invoke)
                  if (
                    result &&
                    typeof result === 'object' &&
                    'ok' in result &&
                    result.ok === false
                  ) {
                    action.fail(
                      new Error(
                        'message' in result && typeof result.message === 'string'
                          ? result.message
                          : `${serviceKey.toString()}.${key.toString()} failed`,
                      ),
                    )
                  }
                  return result
                })
              : invoke()
          }
          o[key] = f
          return f
        },
      },
    )
    return service
  }

  getService<T>(key: ServiceKey<T>): T {
    const cached = this.cache[key.toString()]
    if (!cached) {
      const proxy = this.createProxy(key)
      this.cache[key.toString()] = proxy
      return proxy as T
    }
    return cached
  }
}

export function useServiceFactory() {
  return new ServiceFactoryImpl()
}

export const kServiceFactory: InjectionKey<ServiceFactory> = Symbol('SERVICES_KEY')

export function useService<T = unknown>(name: ServiceKey<T>): T {
  return injection(kServiceFactory).getService(name)
}

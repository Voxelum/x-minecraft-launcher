import { RemoteServerServiceKey } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultRendererActionName, ServiceFactoryImpl } from './service'

describe('getDefaultRendererActionName', () => {
  it.each([
    ['LaunchService', 'launch', [], 'user_action.minecraft.launch'],
    ['BedrockService', 'install', [], 'user_action.instance.install'],
    ['VersionInstallService', 'installInstance', [{}], 'user_action.instance.install'],
    ['VersionInstallService', 'install', [{ type: 'repair' }], 'user_action.instance.repair'],
    ['InstanceInstallService', 'resumeInstanceInstall', [], 'user_action.instance.repair'],
    ['ModpackService', 'importModpack', [], 'user_action.modpack.install'],
    ['InstanceService', 'createInstance', [], 'user_action.instance.create'],
    ['InstanceService', 'duplicateInstance', [], 'user_action.instance.duplicate'],
    ['InstanceService', 'deleteInstance', [], 'user_action.instance.delete'],
    ['RemoteServerService', 'uploadServer', [], 'user_action.remote_server.deploy'],
    ['ModpackService', 'publishModrinth', [], 'user_action.modpack.publish'],
    ['BaseService', 'migrate', [], 'user_action.data_root.migrate'],
    ['BaseService', 'downloadUpdate', [], 'user_action.launcher.update'],
    ['InstanceIOService', 'exportInstanceAsServer', [], 'user_action.instance.export'],
    ['InstanceSavesService', 'deleteSave', [], 'user_action.save.delete'],
    ['UserService', 'login', [], 'user_action.account.login'],
    ['PeerServiceKey', 'shareInstance', [], 'user_action.peer.share_instance'],
    ['InstanceModsService', 'installFromMarket', [], 'user_action.resource.install'],
    ['InstanceResourcePacksService', 'uninstall', [], 'user_action.resource.remove'],
  ])('maps %s.%s to %s', (service, method, payload, expected) => {
    expect(getDefaultRendererActionName(service, method, payload)).toBe(expected)
  })

  it('does not wrap read-only service calls', () => {
    expect(getDefaultRendererActionName('InstanceService', 'getInstance', [])).toBeUndefined()
  })

  it('marks fallback actions failed for service results with ok=false', async () => {
    const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    const callWithTrace = vi.fn().mockResolvedValue({ ok: false, message: 'remote failed' })
    const endAction = vi.fn()
    vi.stubGlobal('serviceChannels', {
      open: () => ({
        on: vi.fn(),
        once: vi.fn(),
        removeListener: vi.fn(),
        callWithTrace,
      }),
    })
    vi.stubGlobal('rendererTelemetry', {
      startAction: vi.fn().mockResolvedValue({ id: 'action-id', traceparent }),
      endAction,
    })

    const service = new ServiceFactoryImpl().getService(RemoteServerServiceKey)
    await expect(service.installService('instance')).resolves.toEqual({
      ok: false,
      message: 'remote failed',
    })
    expect(callWithTrace).toHaveBeenCalledWith(
      { traceparent, actionId: 'action-id' },
      'installService',
      'instance',
    )
    expect(endAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'action-id',
        outcome: 'error',
        error: expect.objectContaining({ message: 'remote failed' }),
      }),
    )
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

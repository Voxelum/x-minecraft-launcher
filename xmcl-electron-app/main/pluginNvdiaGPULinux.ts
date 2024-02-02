import { app as elec } from 'electron'
import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { kSettings } from '~/settings'

export const pluginNvdiaGPULinux: LauncherAppPlugin = async (app) => {
  app.registry.get(LaunchService).then((servi) => {
    servi.registerMiddleware({
      name: 'nvidia-gpu-linux',
      async onBeforeLaunch(input, output) {
        if (app.platform.os !== 'linux') return
        const settings = await app.registry.get(kSettings)
        if (settings.linuxEnableDedicatedGPUOptimization) {
          const env = output.extraExecOption?.env || {}
          const info = (await elec.getGPUInfo('basic')) as any
          const gpus =
            info?.gpuDevice
              ?.filter((v: any) => v?.vendorId !== 5140)
              .map((v: any) => v.vendorId) || []
          if (gpus.some((g: string) => g?.toLowerCase().includes('nvidia'))) {
            env.__NV_PRIME_RENDER_OFFLOAD = '1'
            env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia'
            output.extraExecOption = { ...output.extraExecOption, env }
          }
        }
      },
    })
  })
}

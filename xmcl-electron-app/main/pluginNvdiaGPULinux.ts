import { app as elec } from 'electron'
import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { kSettings } from '~/settings'

export const pluginNvdiaGPULinux: LauncherAppPlugin = async (app) => {
  app.registry.get(LaunchService).then((servi) => {
    servi.registerMiddleware({
      name: 'nvidia-gpu-linux',
      async onBeforeLaunch(input, payload, output) {
        if (app.platform.os !== 'linux') return
        if (payload.side === 'server') return
        const settings = await app.registry.get(kSettings)
        if (settings.enableDedicatedGPUOptimization) {
          const env = output.extraExecOption?.env || {
            ...process.env,
          }
          const info = (await elec.getGPUInfo('basic')) as any
          interface GpuDevice {
            vendorId: number
            deviceId: number
          }
          const gpus: GpuDevice[] =
            info?.gpuDevice
              ?.filter((v: GpuDevice) => v?.vendorId !== 5140) || []
          if (gpus.some((g) => g.vendorId === 4318)) {
            env.__NV_PRIME_RENDER_OFFLOAD = '1'
            env.__GLX_VENDOR_LIBRARY_NAME = 'nvidia'
            output.extraExecOption = { ...output.extraExecOption, env }
          }
        }
      },
    })
  })
}

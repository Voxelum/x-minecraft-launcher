import { LauncherAppPlugin } from '~/app'
import { LaunchService } from '~/launch'
import { kSettings } from '~/settings'
import { getDiscreteGPUEnvironment } from './discreteGPULinux'

export const pluginDiscreteGPULinux: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('DiscreteGPULinux')
  app.registry.get(LaunchService).then((servi) => {
    servi.registerMiddleware({
      name: 'discrete-gpu-linux',
      async onBeforeLaunch(input, payload) {
        if (app.platform.os !== 'linux') return
        if (payload.side === 'server') return
        const ops = payload.options
        const settings = await app.registry.get(kSettings)
        if (settings.enableDedicatedGPUOptimization) {
          const info = (await app.host.getGPUInfo('basic'))
          const gpuEnv = getDiscreteGPUEnvironment((info as any)?.gpuDevice ?? [], (info as any)?.auxAttributes?.multiGpuStyle)
          if (Object.keys(gpuEnv).length > 0) {
            const env = { ...process.env, ...gpuEnv }
            if (gpuEnv.DRI_PRIME) {
              logger.log(`Setting DRI_PRIME=${env.DRI_PRIME} for discrete GPU offloading`)
            }
            if (gpuEnv.__NV_PRIME_RENDER_OFFLOAD) {
              logger.log('Setting NVIDIA offloading environment variables')
            }
            if (ops.extraExecOption?.env) {
              Object.assign(env, ops.extraExecOption?.env)
            }
            ops.extraExecOption = { ...ops.extraExecOption, env }
          }
        }
      },
    })
  })
}

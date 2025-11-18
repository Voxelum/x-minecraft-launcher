import { LauncherApp, LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'

/**
 * Plugin to add AMD GPU workaround for rendering issues on Windows
 * 
 * This addresses the issue where AMD driver version 25.10.2 and higher
 * causes invisible blocks when using Sodium mod in Minecraft.
 * 
 * Fix: Add -Dorg.lwjgl.util.DebugLoader=true to JVM arguments
 * Reference: https://github.com/CaffeineMC/sodium/issues/3318
 */
export const pluginAMDGPUWorkaround: LauncherAppPlugin = async (app) => {
  // Only apply on Windows
  if (app.platform.os !== 'windows') return

  const info = await app.host.getGPUInfo('basic') as any
  const gpus = info?.gpuDevice || []
  
  // Check if AMD GPU is present (vendor ID 4098 = 0x1002)
  const hasAMD = gpus.some((gpu: any) => gpu?.vendorId === 4098)
  
  if (!hasAMD) return

  const { log } = app.getLogger('AMDGPUWorkaround')
  log('Detected AMD GPU on Windows. Applying LWJGL debug loader workaround for Sodium compatibility.')

  app.registry.get(LaunchService).then((service) => {
    service.registerMiddleware({
      name: 'amd-gpu-workaround',
      async onBeforeLaunch(input, payload) {
        // Only apply to client-side launches
        if (payload.side === 'server') return

        const lwjglDebugFlag = '-Dorg.lwjgl.util.DebugLoader=true'
        
        // Check if the flag is already present
        if (!payload.options.extraJVMArgs) {
          payload.options.extraJVMArgs = []
        }
        
        if (!payload.options.extraJVMArgs.includes(lwjglDebugFlag)) {
          payload.options.extraJVMArgs.push(lwjglDebugFlag)
          log('Added LWJGL debug loader flag for AMD GPU compatibility')
        }
      },
    })
  })
}

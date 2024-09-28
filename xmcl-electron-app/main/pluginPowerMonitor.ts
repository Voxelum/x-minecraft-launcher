import { LauncherApp, LauncherAppPlugin } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'

import { exec } from 'child_process'
import { powerMonitor, app as elec } from 'electron'
import { ensureElevateExe } from './utils/elevate'
import { AnyError } from '~/util/error'
import { kSettings } from '~/settings'

const enum PerformanceType {
  AUTO = 0,
  POWER_SAVING = 1,
  HIGH_PERFORMANCE = 2,
}

export const pluginPowerMonitor: LauncherAppPlugin = async (app) => {
  if (app.platform.os !== 'windows') return

  const info = await elec.getGPUInfo('basic') as any
  const gpus = info?.gpuDevice?.filter((v: any) => v?.vendorId !== 5140)
    .map((v: any) => v.vendorId) || []
  const { log, warn, error } = app.getLogger('GPUOptifimizer')
  if (gpus.length < 2) {
    log(`Detected GPUs: [${gpus.join(', ')}]`)
    return
  }

  log(`Detected GPUs [${gpus.join(', ')}]. Trying to assign Minecraft JVM to high performance GPU`)

  app.registry.get(LaunchService).then((servi) => {
    servi.registerMiddleware({
      name: 'gpu-optimization',
      async onBeforeLaunch(input, payload, output) {
        if (payload.side === 'server') return
        const javaPath = output.javaPath
        const settings = await app.registry.get(kSettings)
        if (settings.enableDedicatedGPUOptimization) {
          try {
            const result = await queryGPUStatus(javaPath)
            log(`JVM GPU setting: ${result}`)
          } catch (e) {
            // No GPU status
            warn(`No GPU assignment: ${(e as any).message}`)
            try {
              await addRegistryKey(app, javaPath, powerMonitor.onBatteryPower ? PerformanceType.POWER_SAVING : PerformanceType.HIGH_PERFORMANCE)
              log('Assigned Minecraft JVM to high performance GPU')
            } catch (e) {
              if (e instanceof Error) {
                e.name = 'GPUOptimizationError'
              } else {
                error(new AnyError('GPUOptimizationError', 'Failed to assign Minecraft JVM to high performance GPU', { cause: e }))
              }
            }
          }
        }
      },
    })
  })
}

function queryGPUStatus(javaPath: string) {
  return new Promise<string>((resolve, reject) => {
    exec(`@chcp 65001 >nul & cmd /d/s/c REG QUERY HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences /v "${javaPath}"`, (err, out, stderr) => {
      if (err) {
        reject(new Error(stderr))
      } else {
        resolve(out)
      }
    })
  })
}

async function addRegistryKey(app: LauncherApp, javaPath: string, type: PerformanceType) {
  const elevate = await ensureElevateExe(app.appDataPath)
  return new Promise<string>((resolve, reject) => {
    const val = `GpuPreference=${type};`
    exec(`@chcp 65001 >nul & "${elevate}" cmd /d/s/c REG ADD HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\DirectX\\UserGpuPreferences /v "${javaPath}" /t REG_SZ /d ${val} /f`, (err, out, stderr) => {
      if (err) {
        reject(new Error(stderr))
      } else {
        resolve(out)
      }
    })
  })
}

import { LaunchService, LauncherApp, LauncherAppPlugin } from '@xmcl/runtime'
import { exec } from 'child_process'
import { powerMonitor, app as elec } from 'electron'
import { ensureElevateExe } from './utils/elevate'

const enum PerformanceType {
  AUTO = 0,
  POWER_SAVING = 1,
  HIGH_PERFORMANCE = 2,
}

export const pluginPowerMonitor: LauncherAppPlugin = async (app) => {
  if (app.platform.os !== 'windows') {
    return
  }
  const { log, warn } = app.getLogger('GPUOptifimizer')
  app.registry.get(LaunchService).then((servi) => {
    servi.registerPlugin({
      async onBeforeLaunch(input, output) {
        const javaPath = output.javaPath
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
            warn(`Failed to assign Minecraft JVM to high performance GPU: ${(e as any).message}`)
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

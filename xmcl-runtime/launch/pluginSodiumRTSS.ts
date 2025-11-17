import { readdir } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin } from '~/app'
import { LaunchService } from './LaunchService'

/**
 * Plugin to automatically add Sodium RTSS compatibility flag on Windows systems.
 * 
 * Sodium 0.5.7+ intentionally crashes when an incompatible version of RivaTuner Statistics Server
 * (RTSS) is detected. This plugin detects if Sodium is installed and automatically adds the JVM
 * argument to bypass this check, allowing the game to launch normally.
 * 
 * This ensures compatibility with systems that have RTSS/MSI Afterburner installed,
 * matching the behavior of other launchers like Prism Launcher.
 * 
 * @see https://github.com/CaffeineMC/sodium/wiki/Known-Issues
 */
export const pluginSodiumRTSS: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)

  launchService.registerMiddleware({
    name: 'sodium-rtss-workaround',
    async onBeforeLaunch(input, payload) {
      // Only apply on Windows and for client-side launches
      if (process.platform !== 'win32' || payload.side !== 'client') {
        return
      }

      try {
        // Check if Sodium mod is present in the mods folder
        const modsDir = join(input.gameDirectory, 'mods')
        const files = await readdir(modsDir).catch(() => [] as string[])
        
        // Look for Sodium mod files (case-insensitive)
        const hasSodium = files.some(file => 
          file.toLowerCase().includes('sodium') && 
          (file.endsWith('.jar') || file.endsWith('.jar.disabled'))
        )

        if (hasSodium) {
          const rtssFlag = '-Dsodium.checks.win32.rtss=false'
          
          // Check if the flag is already present to avoid duplicates
          const extraJVMArgs = payload.options.extraJVMArgs || []
          if (!extraJVMArgs.includes(rtssFlag)) {
            launchService.log(`Sodium mod detected on Windows. Adding RTSS compatibility flag: ${rtssFlag}`)
            extraJVMArgs.push(rtssFlag)
            payload.options.extraJVMArgs = extraJVMArgs
          }
        }
      } catch (e) {
        // Log error but don't fail the launch
        launchService.warn('Failed to check for Sodium mod:', e)
      }
    },
  })
}

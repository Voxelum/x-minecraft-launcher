import { ResolvedLibrary, Version } from '@xmcl/core'
import { LauncherAppPlugin } from '~/app'
import { kSettings } from '~/settings'
import { VersionService } from '~/version'

/**
 * Reference:
 * https://github.com/HMCL-dev/HMCL/blob/main/HMCL/src/main/java/org/jackhuang/hmcl/util/NativePatcher.java
 */
export const pluginNativeReplacer: LauncherAppPlugin = async (app) => {
  const settings = await app.registry.get(kSettings)
  const logger = app.getLogger('nativeReplacer')
  app.registry.get(VersionService).then(serv => {
    serv.registerResolver(async (version) => {
      if (!settings.replaceNatives) {
        logger.log('Skip native replacement because it is disabled.')
        return
      }
      const mcVersion = version.minecraftVersion.split('.')
      const minor = parseInt(mcVersion[1])

      let libraries = version.libraries
      if (minor >= 19) {
        if (settings.replaceNatives === 'legacy-only') {
          logger.log('Skip native replacement because it is disabled for modern version.')
          return
        }
        if ((process.platform === 'linux' || process.platform === 'openbsd' || process.platform === 'freebsd')) {
          libraries = libraries.filter((lib) => !(lib.groupId === 'org.lwjgl' &&
            lib.classifier?.startsWith('natives') &&
            (lib.artifactId === 'lwjgl-glfw' || lib.artifactId === 'lwjgl-openal')
          ))
        }
      }

      if ((process.arch === 'ia32' || process.arch === 'x64') && (process.platform === 'win32' || process.platform === 'linux' || process.platform === 'darwin')) {
        version.libraries = libraries
        return
      }

      if (process.arch === 'arm64' && (process.platform === 'darwin' || process.platform === 'win32') && minor >= 19) {
        version.libraries = libraries
        return
      }

      logger.log('Replace natives for version', version.id)

      const natives: Record<string, Record<string, Version.Library | null>> = (await import('./natives.json')).default
      const archMapping: Record<string, 'loongarch64' | 'arm32' | 'x86_64' | undefined> = {
        loong64: 'loongarch64',
        arm: 'arm32',
        x64: 'x86_64',
      }
      let arch = archMapping[app.platform.arch] ?? process.arch
      if (arch === 'loongarch64' && app.platform.osRelease.localeCompare('5.19') < 0) {
        arch += '_ow'
      }
      const platformArch = `${app.platform.os}-${arch}`
      const replacement = natives[platformArch]
      if (!replacement) {
        logger.log('Skip native replacement because no replacement for', platformArch)
        return
      }
      const replaced: ResolvedLibrary[] = []
      for (const original of libraries) {
        const candidate = replacement[original.isNative ? `${original.groupId}:${original.artifactId}:${original.version}:natives` : original.name]
        const resolved = candidate ? Version.resolveLibrary(candidate, app.platform as any) : undefined
        replaced.push(resolved || original)
      }
      version.libraries = replaced
    })
  })
}

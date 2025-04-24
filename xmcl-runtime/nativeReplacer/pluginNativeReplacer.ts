import { ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import { LauncherApp, LauncherAppPlugin } from '~/app'
import { kSettings } from '~/settings'
import { VersionService } from '~/version'

function replaceLibs(version: ResolvedVersion, replacement: Record<string, Version.Library | null>, app: LauncherApp) {
  const replaced: ResolvedLibrary[] = []
  for (const original of version.libraries) {
    const candidate = replacement[original.isNative ? `${original.groupId}:${original.artifactId}:${original.version}:natives` : original.name]
    const resolved = candidate ? Version.resolveLibrary(candidate, {
      name: app.platform.os,
      arch: app.platform.arch,
      version: app.platform.osRelease,
    }) : undefined
    replaced.push(resolved || original)
  }
  version.libraries = replaced
}

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
      const legacyOnly = settings.replaceNatives === 'legacy-only'
      const isLegacy = minor < 19 || !legacyOnly

      switch (process.platform) {
        case 'win32': {
          if (isLegacy && process.arch === 'arm64') {
            const natives = (await import('./natives.json')).default['windows-x86']
            replaceLibs(version, natives, app)
          }
          break
        }
        case 'darwin': {
          if (isLegacy && process.arch === 'arm64')  {
            const natives = (await import('./natives.json')).default['osx-arm64']
            replaceLibs(version, natives, app)
          }
          break
        }
        case 'linux': {
          // does not support linux arm64 anyway
          if (process.arch === 'arm64') {
            const natives = (await import('./natives.json')).default['linux-arm64']
            replaceLibs(version, natives, app)
            // @ts-expect-error
          } else if (process.arch === 'arm' || process.arch === 'mipsel' || process.arch === 'riscv64' || process.arch === 'loong64') {
            const arch = process.arch === 'arm' ? 'arm32' : process.arch === 'mipsel' ? 'mips64el' : process.arch === 'riscv64' ? 'riscv64' : 'loongarch64'
            const target = `linux-${arch}` as const
            const natives = (await import('./natives.json')).default[target]
            replaceLibs(version, natives, app)
          }
        }
      }
    })
  })
}

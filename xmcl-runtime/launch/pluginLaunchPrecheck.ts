import { LaunchPrecheck, MinecraftFolder, diagnoseJar, diagnoseLibraries } from '@xmcl/core'
import { LaunchException, protocolToMinecraft, resolveForgeVersion } from '@xmcl/runtime-api'
import { move, readlink, stat, symlink, unlink } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { InstallService } from '~/install'
import { InstanceService } from '~/instance'
import { JavaService, JavaValidation } from '~/java'
import { LaunchService } from '~/launch'
import { PeerService } from '~/peer'

export const pluginLaunchPrecheck: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const getPath = await app.registry.get(kGameDataPath)

  const linkFolder = async (gameDirectory: string, folder: string) => {
    const libPath = getPath(folder)
    const destPath = join(gameDirectory, folder)
    const linkTarget = await readlink(destPath).catch(() => undefined)
    if (linkTarget && linkTarget !== libPath) {
      // relink
      await unlink(destPath)
      await symlink(libPath, destPath)
      return
    }
    const fstat = await stat(destPath).catch((e) => undefined)
    if (!fstat) {
      await symlink(libPath, destPath)
      return
    }
    if (fstat.isSymbolicLink() && (await readlink(destPath) !== libPath)) {
      // relink
      await unlink(destPath)
      await symlink(libPath, destPath)
      return
    }
    await move(destPath, join(gameDirectory, folder + '.bk'))
    await symlink(libPath, destPath)
  }

  launchService.registerMiddleware({
    name: 'java-validation',
    async onBeforeLaunch(input) {
      const javaService = await app.registry.getOrCreate(JavaService)
      const javaPath = input.java
      try {
        const result = await javaService.validateJavaPath(javaPath)
        if (result === JavaValidation.NotExisted) {
          throw new LaunchException({ type: 'launchInvalidJavaPath', javaPath })
        }
        if (result === JavaValidation.NoPermission) {
          throw new LaunchException({ type: 'launchJavaNoPermission', javaPath })
        }
      } catch (e) {
        throw new LaunchException({ type: 'launchNoProperJava', javaPath }, 'Cannot launch without a valid java', { cause: e })
      }
    },
  })
  launchService.registerMiddleware({
    name: 'check-assets',
    async onBeforeLaunch(input, payload) {
      if (payload.side === 'server') return
      const resolvedVersion = payload.version
      if (!input?.skipAssetsCheck) {
        const resourceFolder = new MinecraftFolder(getPath())
        await Promise.all([
          diagnoseJar(resolvedVersion, resourceFolder, { side: input.side }).then(async (issue) => {
            if (issue?.type === 'missing') {
              const installService = await app.registry.getOrCreate(InstallService)
              return installService.installMinecraftJar(resolvedVersion, input.side)
            }
          }),
          diagnoseLibraries(resolvedVersion, resourceFolder).then(async (libs) => {
            const missing = libs.filter((l) => l.type === 'missing')
            if (missing.length > 0) {
              const installService = await app.registry.getOrCreate(InstallService)
              await installService.installLibraries(libs.map(l => l.library))
            }
          }),
        ])
      }

      const commonLibs = resolvedVersion.libraries.filter(lib => !lib.isNative)
      for (const lib of commonLibs) {
        if (!lib.download.path) {
          (lib.download as any).path = lib.path
          if (!lib.download.path) {
            throw new LaunchException({ type: 'launchBadVersion', version: resolvedVersion.id }, JSON.stringify(lib))
          }
        }
      }
    },
  })
  launchService.registerMiddleware({
    name: 'check-natives',
    async onBeforeLaunch(input, payload, options) {
      if (payload.side === 'server') return
      const resourceFolder = new MinecraftFolder(getPath())
      await LaunchPrecheck.checkNatives(resourceFolder, payload.version, payload.options)
    },
  })
  launchService.registerMiddleware({
    name: 'expose-server',
    async onBeforeLaunch(input, payload, options) {
      if (payload.side === 'client') return

      const peer = await app.registry.getIfPresent(PeerService)
      if (peer && payload.side === 'server') {
        const ver = payload.version.minecraftVersion
        const minecraftToProtocol: Record<string, number> = {}
        for (const [protocol, vers] of Object.entries(protocolToMinecraft)) {
          for (const v of vers) {
            minecraftToProtocol[v] = parseInt(protocol)
          }
        }
        // peer.exposePort(25565, minecraftToProtocol[ver] ?? 765)
      }
    },
  })

  app.registry.get(InstanceService).then((serv) => {
    serv.state.subscribe('instanceAdd', ({ path }) => {
      linkFolder(path, 'libraries')
      linkFolder(path, 'versions')
    })
  })
  launchService.registerMiddleware({
    name: 'link-assets',
    async onBeforeLaunch(input, payload) {
      if (payload.side === 'client') {
        const { version, options } = payload
        const resourceFolder = new MinecraftFolder(getPath())
        await LaunchPrecheck.linkAssets(resourceFolder, version, options)

        if (!version.inheritances[version.inheritances.length - 1].startsWith('1.4.')) {
          return
        }
        const forgeVersion = resolveForgeVersion(version as any)
        if (!forgeVersion) {
          return
        }
        await linkFolder(input.gameDirectory, 'libraries')
      } else {
        await Promise.all([
          linkFolder(input.gameDirectory, 'libraries'),
          linkFolder(input.gameDirectory, 'versions'),
        ])
      }
    },
  })
}

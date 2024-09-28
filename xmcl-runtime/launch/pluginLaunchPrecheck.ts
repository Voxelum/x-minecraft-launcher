import { LaunchPrecheck, MinecraftFolder, diagnoseJar, diagnoseLibraries } from '@xmcl/core'
import { LaunchException, protocolToMinecraft, resolveFabricLoaderVersion, resolveForgeVersion, resolveQuiltVersion } from '@xmcl/runtime-api'
import { ensureDir, move, readlink, stat, unlink } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { InstallService } from '~/install'
import { InstanceService } from '~/instance'
import { JavaService, JavaValidation } from '~/java'
import { LaunchService } from '~/launch'
import { PeerService } from '~/peer'
import { createSymbolicLink, missing } from '~/util/fs'

export const pluginLaunchPrecheck: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const getPath = await app.registry.get(kGameDataPath)

  const ensureLinkFolder = async (fromPath: string, toPath: string) => {
    if (await missing(fromPath)) {
      await ensureDir(fromPath)
    }
    const linkTarget = await readlink(toPath).catch(() => undefined)
    if (linkTarget) {
      // relink
      if (linkTarget !== fromPath) {
        await unlink(toPath)
        await createSymbolicLink(fromPath, toPath, launchService)
      }
      return
    }
    const fstat = await stat(toPath).catch((e) => undefined)
    if (!fstat) {
      await createSymbolicLink(fromPath, toPath, launchService)
      return
    }
    await move(toPath, join(toPath + '.bk'))
    await createSymbolicLink(fromPath, toPath, launchService)
  }
  const ensureLinkFolderFromRoot = async (gameDirectory: string, folder: string) => {
    const fromPath = getPath(folder)
    const toPath = join(gameDirectory, folder)
    await ensureLinkFolder(fromPath, toPath)
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
              return installService.installMinecraftJar(resolvedVersion.id, input.side)
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
        peer.exposePort(25565, minecraftToProtocol[ver] ?? 765)
      }
    },
    async onAfterLaunch(result, payload, context) {
      if (payload.side === 'server') {
        const peer = await app.registry.getIfPresent(PeerService)
        if (peer) {
          peer.unexposePort(25565)
        }
      }
    },
  })

  app.registry.get(InstanceService).then((serv) => {
    serv.state.subscribe('instanceAdd', ({ path }) => {
      ensureLinkFolderFromRoot(path, 'libraries')
      ensureLinkFolderFromRoot(path, 'versions')
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
        if (forgeVersion) {
          await ensureLinkFolderFromRoot(input.gameDirectory, 'libraries')
        }

        const fabricVersion = resolveFabricLoaderVersion(version as any)
        if (fabricVersion) {
          await Promise.all([
            ensureLinkFolderFromRoot(input.gameDirectory, '.fabric'),
            ensureLinkFolderFromRoot(input.gameDirectory, '.mixin.out'),
          ])
        }

        const quilt = resolveQuiltVersion(version as any)
        if (quilt) {
          await ensureLinkFolderFromRoot(input.gameDirectory, '.cache')
        }
      } else {
        const dir = join(input.gameDirectory, 'server')
        const { version } = payload

        const fabricVersion = resolveFabricLoaderVersion(version as any)
        if (fabricVersion) {
          await Promise.all([
            ensureLinkFolderFromRoot(dir, '.fabric'),
            ensureLinkFolderFromRoot(dir, '.mixin.out'),
          ])
        }

        const quilt = resolveQuiltVersion(version as any)
        if (quilt) {
          await ensureLinkFolderFromRoot(dir, '.cache')
        }

        await Promise.all([
          ensureLinkFolderFromRoot(dir, 'libraries'),
          ensureLinkFolderFromRoot(dir, 'versions'),
          ensureLinkFolder(join(input.gameDirectory, 'config'), join(dir, 'config')),
        ])
      }
    },
  })
}

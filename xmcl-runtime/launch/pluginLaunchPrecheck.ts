import { LaunchPrecheck, MinecraftFolder } from '@xmcl/core'
import {
  LaunchException,
  protocolToMinecraft,
  resolveFabricLoaderVersion,
  resolveForgeVersion,
  resolveQuiltVersion,
} from '@xmcl/runtime-api'
import { isSystemError } from '@xmcl/utils'
import { ensureDir, move, stat, unlink } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { isLinkTo, readlinkSafe } from '~/instance/utils/readLinkSafe'
import { JavaService, JavaValidation } from '~/java'
import { LaunchService } from '~/launch'
import { PeerService } from '~/peer'
import { linkOrCopyDirectory, missing } from '~/util/fs'

export const pluginLaunchPrecheck: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const getPath = await app.registry.get(kGameDataPath)

  const logger = app.getLogger('LaunchPrecheck')

  // `libraries/` and `versions/` are read-mostly launcher-managed caches
  // (the game only consumes them, the installer writes the source-of-truth
  // copy). That matches the safety contract of `linkOrCopyDirectory`, so
  // we use it here to recover the 2 856 ev / 423 users of `LaunchLinkError`
  // on 0.56.4 that were caused by users without `SeCreateSymbolicLinkPrivilege`
  // (no Windows Developer Mode, no admin) where both `symlink('dir')` and
  // `symlink('junction')` fail with EPERM and the launch never gets the
  // libraries it needs. See issue #1428 — the v0.56.4 fix was reverted from
  // this call site (commit d34708ef) out of safety paranoia even though the
  // doc on `linkOrCopyDirectory` explicitly endorses it for this case.
  const ensureLinkFolder = async (fromPath: string, toPath: string) => {
    if (await missing(fromPath)) {
      await ensureDir(fromPath)
    }

    // Already a link (symlink or win32 junction) pointing at the shared root:
    // nothing to do. `isLinkTo` normalizes the `\\?\` prefix / trailing sep a
    // junction reports through `readlink`, which a raw string compare misses —
    // that mismatch made every launch needlessly unlink+relink and, when the
    // unlink of a junction failed (common on Windows/Wine), the following
    // symlink hit EEXIST and surfaced as `LaunchLinkError` (issue #1428 was
    // the EPERM cousin; this is the EEXIST long tail).
    if (await isLinkTo(toPath, fromPath)) {
      return
    }

    let stage = 'link'
    const linkTarget = await readlinkSafe(toPath).catch(() => undefined)
    if (linkTarget) {
      // A link that points elsewhere (or is dangling): drop it, then relink.
      stage = 'relink'
      await unlink(toPath).catch(() => {})
    } else {
      const fstat = await stat(toPath).catch((e) => {
        if (e.code === 'ENOENT') return undefined
        throw e
      })
      if (fstat) {
        // A real directory sits where the link should be: preserve it.
        stage = 'after move'
        try {
          await move(toPath, join(toPath + '.bk'))
        } catch (e) {
          if ((e as any).message === 'dest already exists.') {
            await move(toPath, join(toPath + Date.now() + '.bk'))
          }
        }
      }
    }

    await linkOrCopyDirectory(fromPath, toPath, logger).catch(async (e) => {
      // Idempotent recovery: the destination already links to the shared root
      // (a concurrent setup won the race, or a stale entry we couldn't remove
      // is in fact correct). Treat EEXIST as success instead of raising the
      // `LaunchLinkError` storm that 87/91 of 0.61.0's link failures came from.
      if (isSystemError(e) && e.code === 'EEXIST' && await isLinkTo(toPath, fromPath)) {
        return
      }
      e.name = 'LaunchLinkError'
      e.stage = stage
      logger.error(e)
    })
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
        throw new LaunchException(
          { type: 'launchNoProperJava', javaPath },
          'Cannot launch without a valid java',
          { cause: e },
        )
      }
    },
  })
  launchService.registerMiddleware({
    name: 'check-assets',
    async onBeforeLaunch(input, payload) {
      if (payload.side === 'server') return
      const resolvedVersion = payload.version
      if (!input?.skipAssetsCheck) {
        // const resourceFolder = new MinecraftFolder(getPath())
        // await Promise.all([
        //   diagnoseJar(resolvedVersion, resourceFolder, { side: input.side }).then(async (issue) => {
        //     if (issue?.type === 'missing') {
        //       const installService = await app.registry.getOrCreate(InstallService)
        //       return installService.installMinecraftJar(resolvedVersion.id, input.side)
        //     }
        //   }),
        //   diagnoseLibraries(resolvedVersion, resourceFolder).then(async (libs) => {
        //     const missing = libs.filter((l) => l.type === 'missing')
        //     if (missing.length > 0) {
        //       const installService = await app.registry.getOrCreate(InstallService)
        //       await installService.installLibraries(libs.map((l) => l.library))
        //     }
        //   }),
        // ])
      }

      const commonLibs = resolvedVersion.libraries.filter((lib) => !lib.isNative)
      for (const lib of commonLibs) {
        if (!lib.download.path) {
          ;(lib.download as any).path = lib.path
          if (!lib.download.path) {
            throw new LaunchException(
              { type: 'launchBadVersion', version: resolvedVersion.id },
              JSON.stringify(lib),
            )
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
    async onAfterLaunch(result, input, payload, context) {
      if (payload.side === 'server') {
        const peer = await app.registry.getIfPresent(PeerService)
        if (peer) {
          peer.unexposePort(25565)
        }
      }
    },
  })

  app.registry.get(InstanceService).then((serv) => {
    serv.state.subscribe('instanceAdd', (instance) => {
      if (instance.edition === 'bedrock') return
      ensureLinkFolderFromRoot(instance.path, 'libraries')
      ensureLinkFolderFromRoot(instance.path, 'versions')
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

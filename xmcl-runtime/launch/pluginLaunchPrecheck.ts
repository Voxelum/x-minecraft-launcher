import { LaunchPrecheck, MinecraftFolder, diagnoseJar, diagnoseLibraries } from '@xmcl/core'
import { LaunchException, resolveForgeVersion } from '@xmcl/runtime-api'
import { move, readlink, stat, symlink, unlink } from 'fs-extra'
import { join } from 'path'
import { LauncherAppPlugin, kGameDataPath } from '~/app'
import { InstallService } from '~/install'
import { JavaService, JavaValidation } from '~/java'
import { LaunchService } from '~/launch'

export const pluginLaunchPrecheck: LauncherAppPlugin = async (app) => {
  const launchService = await app.registry.get(LaunchService)
  const getPath = await app.registry.get(kGameDataPath)

  launchService.registerMiddleware({
    name: 'legacy-forge-lib',
    async onBeforeLaunch(input, output) {
      const version = output.version as any
      if (!output.version.inheritances[output.version.inheritances.length - 1].startsWith('1.4.')) {
        return
      }
      const forgeVersion = resolveForgeVersion(version)
      if (!forgeVersion) {
        return
      }
      const libPath = getPath('libraries')
      const destPath = join(input.gameDirectory, 'lib')
      const fstat = await stat(destPath).catch(() => undefined)
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
      await move(destPath, join(input.gameDirectory, 'lib.bk'))
      await symlink(libPath, destPath)
    },
  })

  launchService.registerMiddleware({
    name: 'java-validation',
    async onBeforeLaunch(input, output) {
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
    async onBeforeLaunch(input, output) {
      const resolvedVersion = output.version
      if (!input?.skipAssetsCheck) {
        const resourceFolder = new MinecraftFolder(getPath())
        await Promise.all([
          diagnoseJar(resolvedVersion, resourceFolder).then(async (issue) => {
            if (issue?.type === 'missing') {
              const installService = await app.registry.getOrCreate(InstallService)
              return installService.installMinecraftJar(resolvedVersion)
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
    },
  })
  launchService.registerMiddleware({
    name: 'check-natives',
    async onBeforeLaunch(input, output) {
      const resolvedVersion = output.version
      const resourceFolder = new MinecraftFolder(getPath())
      await LaunchPrecheck.checkNatives(resourceFolder, resolvedVersion, output)
    },
  })
  launchService.registerMiddleware({
    name: 'link-assets',
    async onBeforeLaunch(input, output) {
      const resolvedVersion = output.version
      const resourceFolder = new MinecraftFolder(getPath())
      await LaunchPrecheck.linkAssets(resourceFolder, resolvedVersion, output)
    },
  })
}

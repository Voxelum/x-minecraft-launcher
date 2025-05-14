import { readFile, readdir } from 'fs-extra';
import { LauncherApp, LauncherAppPlugin } from '~/app';
import { InstanceService } from '~/instance';
import { UserService } from '~/user';
import { LaunchService } from './LaunchService';
import { findMatchedVersion, generateLaunchOptionsWithGlobal, getAutoOrManuallJava, getAutoSelectedJava } from '@xmcl/runtime-api';
import { VersionService } from '~/version';
import { JavaService } from '~/java';
import { kSettings } from '~/settings';
import { AuthlibInjectorService } from '~/authlibInjector';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '~/logger';

function getLaunchArguments(argv: string[]) {
  const indexOfLaunch = argv.indexOf('launch')
  if (indexOfLaunch > 0) {
    const userId = argv[indexOfLaunch + 1]
    const instancePath = argv[indexOfLaunch + 2]
    if (userId && instancePath) {
      return [userId, instancePath]
    }
  }
  return []
}

async function handleDirectLaunch(app: LauncherApp, logger: Logger, argv: string[]) {
  logger.log('Checking for direct launch arguments:', argv)
  if (argv.length > 2) {
    const indexOfLaunch = argv.indexOf('launch')
    if (indexOfLaunch > 0) {
      logger.log('Direct launch detected')
      const userId = argv[indexOfLaunch + 1]
      const instancePath = argv[indexOfLaunch + 2]
      if (!userId || !instancePath) {
        return
      }
      logger.log(`Direct launch with userId: ${userId}, instancePath: ${instancePath}`)
      await directLaunch(app, userId, instancePath)
    }
  }
}

async function directLaunch(app: LauncherApp, userId: string, instancePath: string) {
  const userSerivce = await app.registry.getOrCreate(UserService)
  const instanceService = await app.registry.getOrCreate(InstanceService)
  const versionSerivce = await app.registry.getOrCreate(VersionService)
  const launchService = await app.registry.getOrCreate(LaunchService)
  const javaService = await app.registry.getOrCreate(JavaService)
  const authLibService = await app.registry.getOrCreate(AuthlibInjectorService)

  // user
  const users = await userSerivce.getUserState()
  const user = users.users[userId]
  await userSerivce.refreshUser(userId)

  // instance
  const instance = instanceService.state.all[instancePath]
  if (!instance) {
    throw new Error('Instance not found')
  }

  // version
  await versionSerivce.initialize()
  const local = versionSerivce.state.local
  const versionHeader = findMatchedVersion(local,
    instance.version,
    instance.runtime.minecraft,
    instance.runtime.forge,
    instance.runtime.neoForged,
    instance.runtime.fabricLoader,
    instance.runtime.optifine,
    instance.runtime.quiltLoader,
    instance.runtime.labyMod)

  if (!versionHeader) {
    throw new Error('Version not found')
  }

  const resolvedVersion = await versionSerivce.resolveLocalVersion(versionHeader.id)

  // java
  const detected = getAutoSelectedJava(
    javaService.state.all,
    instance.runtime.minecraft,
    instance.runtime.forge,
    resolvedVersion,
  )
  const javaResult = await getAutoOrManuallJava(detected, (path) => javaService.resolveJava(path), instance.java)
  const java = javaResult.java || javaResult.auto.java

  // global setting
  const settings = await app.registry.get(kSettings)
  const globalAssignMemory = settings.globalAssignMemory
  const globalMinMemory = settings.globalMinMemory
  const globalMaxMemory = settings.globalMaxMemory
  const globalHideLauncher = settings.globalHideLauncher
  const globalShowLog = settings.globalShowLog
  const globalFastLaunch = settings.globalFastLaunch
  const globalDisableAuthlibInjector = settings.globalDisableAuthlibInjector
  const globalPreExecuteCommand = settings.globalPreExecuteCommand
  const globalDisableElyByAuthlib = settings.globalDisableElyByAuthlib
  const globalEnv = settings.globalEnv
  const globalVmOptions = settings.globalVmOptions
  const globalMcOptions = settings.globalMcOptions
  const globalPrependCommand = settings.globalPrependCommand

  // mods
  const modCount = await readdir(join(instance.path, 'mods')).then((mods) => mods.length, () => 0)

  // launch
  const launchOptions = await generateLaunchOptionsWithGlobal(
    instance,
    user,
    versionHeader?.id,
    {
      token: '',
      operationId: randomUUID(),
      side: 'client',
      javaPath: java?.path,
      globalEnv,
      globalVmOptions,
      globalMcOptions,
      globalPrependCommand,
      globalAssignMemory,
      globalFastLaunch,
      globalMaxMemory,
      globalHideLauncher,
      globalDisableElyByAuthlib,
      globalDisableAuthlibInjector,
      globalPreExecuteCommand,
      globalShowLog,
      globalMinMemory,
      track: async (_, p) => p,
      modCount,
      getOrInstallAuthlibInjector: () => authLibService.getOrInstallAuthlibInjector(),
    }
  )

  await launchService.launch(launchOptions)
}

export const pluginDirectLaunch: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('DirectLaunch')

  const validArgs = getLaunchArguments(process.argv)
  if (validArgs.length > 0) {
    app.deferredWindowOpen = true
  }

  app.waitEngineReady().then(() => {
    handleDirectLaunch(app, logger, process.argv).catch((e) => {
      logger.error(e)
    }).finally(() => {
      if (app.deferredWindowOpen) {
        app.controller.requireFocus()
      }
    })
  })

  app.on('second-instance', async (argv) => {
    handleDirectLaunch(app, logger, argv).catch((e) => {
      logger.error(e)
    })
  })
}
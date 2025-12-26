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
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { Logger } from '~/infra';
import { AnyError } from '@xmcl/utils';
import { parseCLIArguments, hasCLICommands, getLegacyLaunchArguments } from './CLIArgumentParser';

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
  
  // Try new CLI format first (e.g., -l <instance>)
  const cliArgs = parseCLIArguments(argv)
  
  if (cliArgs.launch) {
    logger.log('CLI launch detected:', cliArgs)
    await directLaunchByName(app, logger, cliArgs.launch, cliArgs.account, cliArgs.server)
    return
  }
  
  if (cliArgs.show) {
    logger.log('Show instance requested:', cliArgs.show)
    // Just bring launcher window to focus - it will show the instance
    return
  }
  
  // Fallback to legacy format (launch "<user-id>" "<instance-path>")
  const legacy = getLegacyLaunchArguments(argv)
  if (legacy) {
    const [userId, instancePath] = legacy
    logger.log(`Legacy launch format detected: userId=${userId}, instancePath=${instancePath}`)
    await directLaunch(app, userId, instancePath)
  }
}

/**
 * Launch instance by friendly name (not full path)
 */
async function directLaunchByName(app: LauncherApp, logger: Logger, instanceNameOrPath: string, accountName?: string, serverAddress?: string) {
  const instanceService = await app.registry.getOrCreate(InstanceService)
  
  // Find instance by name or path
  let instance = instanceService.state.all[instanceNameOrPath]
  
  // If not found by path, try finding by name or folder name
  if (!instance) {
    const instances = Object.values(instanceService.state.all)
    instance = instances.find(inst => 
      inst.name === instanceNameOrPath || 
      basename(inst.path) === instanceNameOrPath
    )
  }
  
  if (!instance) {
    throw new AnyError('DirectLaunchError', `Instance '${instanceNameOrPath}' not found`)
  }
  
  logger.log(`Found instance: ${instance.name} at ${instance.path}`)
  
  // Get user
  const userService = await app.registry.getOrCreate(UserService)
  const users = await userService.getUserState()
  
  let user
  if (accountName) {
    // Find user by username or id
    user = Object.values(users.users).find(u => 
      u.username === accountName || 
      u.id === accountName ||
      u.profileName === accountName
    )
    if (!user) {
      logger.warn(`Account '${accountName}' not found, using default`)
    }
  }
  
  // Use first available user if no specific account requested or not found
  if (!user) {
    user = Object.values(users.users)[0]
  }
  
  if (!user) {
    throw new AnyError('DirectLaunchError', 'No user account found')
  }
  
  user = await userService.refreshUser(user.id)
  logger.log(`Using account: ${user.username}`)
  
  // Launch with optional server
  await directLaunch(app, user.id, instance.path, serverAddress)
}


async function directLaunch(app: LauncherApp, userId: string, instancePath: string, serverAddress?: string) {
  const userSerivce = await app.registry.getOrCreate(UserService)
  const instanceService = await app.registry.getOrCreate(InstanceService)
  const versionSerivce = await app.registry.getOrCreate(VersionService)
  const launchService = await app.registry.getOrCreate(LaunchService)
  const javaService = await app.registry.getOrCreate(JavaService)
  const authLibService = await app.registry.getOrCreate(AuthlibInjectorService)

  // user
  const users = await userSerivce.getUserState()
  let user = users.users[userId] || Object.values(users.users)[0]
  if (!user) {
    throw new AnyError('DirectLaunchError', `User ${userId} not found`)
  }
  user = await userSerivce.refreshUser(user.id)

  // instance
  const instance = instanceService.state.all[instancePath]
  if (!instance) {
    throw new AnyError('DirectLaunchError', 'Instance not found')
  }

  // version
  await versionSerivce.initialize()
  const local = versionSerivce.state.local
  const versionHeader = findMatchedVersion(local,
    instance.version,
    {
      ...instance.runtime,
    })

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

  // Parse server address if provided
  let serverOverride
  if (serverAddress) {
    const [host, portStr] = serverAddress.split(':')
    serverOverride = {
      host,
      port: portStr ? parseInt(portStr, 10) : undefined,
    }
  }

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
      overrides: serverOverride ? { server: serverOverride } : undefined,
    }
  )

  await launchService.launch(launchOptions)
}

export const pluginDirectLaunch: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('DirectLaunch')

  // Check if CLI commands are present
  if (hasCLICommands(process.argv)) {
    app.deferredWindowOpen = true
    logger.log('CLI commands detected, deferring window open')
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
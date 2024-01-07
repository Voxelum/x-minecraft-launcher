import { pluginAutoUpdate } from './pluginAutoUpdate'
import { pluginCommonProtocol } from './pluginCommonProtocol'
import { pluginIconProtocol } from './pluginIconProtocol'
import { pluginPowerMonitor } from './pluginPowerMonitor'

import { pluginGameDataPath } from '@xmcl/runtime/app/pluginGameDataPath'
import { pluginMediaProtocol } from '@xmcl/runtime/base/pluginMediaProtocol'
import { pluginClientToken } from '@xmcl/runtime/clientToken/pluginClientToken'
import { pluginCurseforgeClient } from '@xmcl/runtime/curseforge/pluginCurseforgeClient'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginFlights } from '@xmcl/runtime/flights'
import { pluginGFW } from '@xmcl/runtime/gfw/pluginGFW'
import { pluginImageStorage } from '@xmcl/runtime/imageStore/pluginImageStore'
import { pluginLogConsumer } from '@xmcl/runtime/logger/pluginLogConsumer'
import { pluginCurseforgeModpackHandler } from '@xmcl/runtime/modpack/pluginCurseforgeModpackHandler'
import { pluginModrinthModpackHandler } from '@xmcl/runtime/modpack/pluginModrinthModpackHandler'
import { pluginMcbbsModpackHandler } from '@xmcl/runtime/modpack/pluginMcbbsModpackHandler'
import { pluginNetworkInterface } from '@xmcl/runtime/network/pluginNetworkInterface'
import { pluginUndiciLogger } from '@xmcl/runtime/network/pluginUndiciLogger'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { pluginTasks } from '@xmcl/runtime/task/pluginTasks'
import { pluginTelemetry } from '@xmcl/runtime/telemetry/pluginTelemetry'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'
import { pluginLaunchPrecheck } from '@xmcl/runtime/launch/pluginLaunchPrecheck'
import { pluginUncaughtError } from '@xmcl/runtime/uncaughtError/pluginUncaughtError'

import { LauncherAppPlugin } from '~/app'
import { definedServices } from './definedServices'
import { pluginSetupWorker } from './pluginSetupWorker'

export const definedPlugins: LauncherAppPlugin[] = [
  pluginAutoUpdate,
  pluginPowerMonitor,
  pluginCommonProtocol,
  pluginIconProtocol,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSetupWorker,
  pluginLaunchPrecheck,
  pluginUncaughtError,

  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,
  pluginMcbbsModpackHandler,
  pluginCurseforgeModpackHandler,
  pluginModrinthModpackHandler,
  pluginClientToken,
  pluginCurseforgeClient,
  pluginServicesHandler(definedServices),
  pluginGameDataPath,
  pluginTelemetry,
  pluginLogConsumer,
  pluginSettings,
  pluginGFW,
  pluginTasks,
  pluginImageStorage,
  pluginFlights,
  pluginNetworkInterface,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginUndiciLogger,
  pluginUserTokenStorage,
]

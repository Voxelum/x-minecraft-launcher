import { pluginAutoUpdate } from './pluginAutoUpdate'
import { pluginIconProtocol } from './pluginIconProtocol'
import { pluginNvdiaGPULinux } from './pluginNvdiaGPULinux'
import { pluginPowerMonitor } from './pluginPowerMonitor'

import { pluginCommonProtocol } from '@xmcl/runtime/app/pluginCommonProtocol'
import { pluginApiFallback } from '@xmcl/runtime/app/pluginApiFallback'
import { pluginMediaProtocol } from '@xmcl/runtime/app/pluginMediaProtocol'
import { pluginClientToken } from '@xmcl/runtime/clientToken/pluginClientToken'
import { elyByPlugin } from '@xmcl/runtime/elyby/elyByPlugin'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import { pluginFlights } from '@xmcl/runtime/flights'
import { pluginGFW } from '@xmcl/runtime/gfw/pluginGFW'
import { pluginImageStorage } from '@xmcl/runtime/imageStore/pluginImageStore'
import { pluginLaunchPrecheck } from '@xmcl/runtime/launch/pluginLaunchPrecheck'
import { pluginLogConsumer } from '@xmcl/runtime/logger/pluginLogConsumer'
import { pluginMarketProvider } from '@xmcl/runtime/market/pluginMarketProvider'
import { pluginCurseforgeModpackHandler } from '@xmcl/runtime/modpack/pluginCurseforgeModpackHandler'
import { pluginMcbbsModpackHandler } from '@xmcl/runtime/modpack/pluginMcbbsModpackHandler'
import { pluginMmcModpackHandler } from '@xmcl/runtime/modpack/pluginMmcModpackHandler'
import { pluginModrinthModpackHandler } from '@xmcl/runtime/modpack/pluginModrinthModpackHandler'
import { pluginNativeReplacer } from '@xmcl/runtime/nativeReplacer/pluginNativeReplacer'
import { pluginNetworkInterface } from '@xmcl/runtime/network/pluginNetworkInterface'
import { pluginUndiciLogger } from '@xmcl/runtime/network/pluginUndiciLogger'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { pluginSetup } from '@xmcl/runtime/setup/pluginSetup'
import { pluginTasks } from '@xmcl/runtime/task/pluginTasks'
import { pluginTelemetry } from '@xmcl/runtime/telemetry/pluginTelemetry'
import { pluginUncaughtError } from '@xmcl/runtime/uncaughtError/pluginUncaughtError'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginModrinthAccess } from '@xmcl/runtime/user/pluginModrinthAccess'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilApi } from '@xmcl/runtime/user/pluginYggdrasilApi'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'
import { pluginDirectLaunch } from '@xmcl/runtime/launch/pluginDirectLaunch'

import { LauncherAppPlugin } from '~/app'
import { definedServices } from './definedServices'

export const definedPlugins: LauncherAppPlugin[] = [
  pluginDirectLaunch,
  pluginAutoUpdate,
  pluginPowerMonitor,
  pluginIconProtocol,
  pluginApiFallback,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSetup,
  pluginLaunchPrecheck,
  pluginNvdiaGPULinux,
  pluginUncaughtError,
  pluginNativeReplacer,
  elyByPlugin,
  pluginMarketProvider,
  pluginYggdrasilApi,

  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,
  pluginMcbbsModpackHandler,
  pluginCurseforgeModpackHandler,
  pluginModrinthModpackHandler,
  pluginMmcModpackHandler,
  pluginClientToken,
  pluginServicesHandler(definedServices),
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

  pluginModrinthAccess,

  pluginCommonProtocol,
]

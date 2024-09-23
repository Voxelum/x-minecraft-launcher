import { pluginAutoUpdate } from './pluginAutoUpdate'
import { pluginIconProtocol } from './pluginIconProtocol'
import { pluginNvdiaGPULinux } from './pluginNvdiaGPULinux'
import { pluginPowerMonitor } from './pluginPowerMonitor'

import { pluginCommonProtocol } from '@xmcl/runtime/app/pluginCommonProtocol'
import { pluginMediaProtocol } from '@xmcl/runtime/base/pluginMediaProtocol'
import { pluginClientToken } from '@xmcl/runtime/clientToken/pluginClientToken'
import { pluginCurseforgeClient } from '@xmcl/runtime/curseforge/pluginCurseforgeClient'
import { elyByPlugin } from '@xmcl/runtime/elyby/elyByPlugin'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import { pluginFlights } from '@xmcl/runtime/flights'
import { pluginGFW } from '@xmcl/runtime/gfw/pluginGFW'
import { pluginImageStorage } from '@xmcl/runtime/imageStore/pluginImageStore'
import { pluginLaunchPrecheck } from '@xmcl/runtime/launch/pluginLaunchPrecheck'
import { pluginLogConsumer } from '@xmcl/runtime/logger/pluginLogConsumer'
import { pluginCurseforgeModpackHandler } from '@xmcl/runtime/modpack/pluginCurseforgeModpackHandler'
import { pluginMcbbsModpackHandler } from '@xmcl/runtime/modpack/pluginMcbbsModpackHandler'
import { pluginModrinthModpackHandler } from '@xmcl/runtime/modpack/pluginModrinthModpackHandler'
import { pluginMmcModpackHandler } from '@xmcl/runtime/modpack/pluginMmcModpackHandler'
import { pluinModrinthClient } from '@xmcl/runtime/modrinth/pluginModrinthClient'
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
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'

import { LauncherAppPlugin } from '~/app'
import { definedServices } from './definedServices'

export const definedPlugins: LauncherAppPlugin[] = [
  pluginAutoUpdate,
  pluginPowerMonitor,
  pluginCommonProtocol,
  pluginIconProtocol,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSetup,
  pluginLaunchPrecheck,
  pluginNvdiaGPULinux,
  pluginUncaughtError,
  pluginNativeReplacer,
  elyByPlugin,

  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,
  pluginMcbbsModpackHandler,
  pluginCurseforgeModpackHandler,
  pluginModrinthModpackHandler,
  pluginMmcModpackHandler,
  pluginClientToken,
  pluginCurseforgeClient,
  pluinModrinthClient,
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
]

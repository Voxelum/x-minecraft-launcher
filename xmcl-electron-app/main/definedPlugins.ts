import { pluginAutoUpdate } from './pluginAutoUpdate'
import { pluginIconProtocol } from './pluginIconProtocol'
import { pluginNvdiaGPULinux } from './pluginNvdiaGPULinux'
import { pluginPowerMonitor } from './pluginPowerMonitor'

import { pluginApiFallback } from '@xmcl/runtime/app/pluginApiFallback'
import { pluginCommonProtocol } from '@xmcl/runtime/app/pluginCommonProtocol'
import { pluginMediaProtocol } from '@xmcl/runtime/app/pluginMediaProtocol'
import { elyByPlugin } from '@xmcl/runtime/elyby/elyByPlugin'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import * as infraPlugins from '@xmcl/runtime/infra/plugins'
import * as launchPlugins from '@xmcl/runtime/launch/plugins'
import { pluginMarketProvider } from '@xmcl/runtime/market/pluginMarketProvider'
import { pluginNativeReplacer } from '@xmcl/runtime/nativeReplacer/pluginNativeReplacer'
import { pluginNetworkInterface } from '@xmcl/runtime/network/pluginNetworkInterface'
import { pluginUndiciLogger } from '@xmcl/runtime/network/pluginUndiciLogger'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { pluginSetup } from '@xmcl/runtime/setup/pluginSetup'
import { pluginModrinthAccess } from '@xmcl/runtime/user/pluginModrinthAccess'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilApi } from '@xmcl/runtime/user/pluginYggdrasilApi'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'

import { LauncherAppPlugin } from '~/app'
import { definedServices } from './definedServices'

export const definedPlugins: LauncherAppPlugin[] = [
  ...Object.values(launchPlugins),
  ...Object.values(infraPlugins),
  pluginAutoUpdate,
  pluginPowerMonitor,
  pluginIconProtocol,
  pluginApiFallback,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSetup,
  pluginNvdiaGPULinux,
  pluginNativeReplacer,
  elyByPlugin,
  pluginMarketProvider,
  pluginYggdrasilApi,

  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,
  pluginServicesHandler(definedServices),
  pluginSettings,
  pluginNetworkInterface,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginUndiciLogger,
  pluginUserTokenStorage,

  pluginModrinthAccess,

  pluginCommonProtocol,
]

import { pluginAgentProtocol } from '@xmcl/runtime/agent'
import type { LauncherAppPlugin } from '@xmcl/runtime/app'
import { pluginApiFallback } from '@xmcl/runtime/app/pluginApiFallback'
import { pluginCommonProtocol } from '@xmcl/runtime/app/pluginCommonProtocol'
import { pluginMediaProtocol } from '@xmcl/runtime/app/pluginMediaProtocol'
import { pluginCli } from '@xmcl/runtime/commands/pluginCli'
import { pluginCommandHost } from '@xmcl/runtime/commands/pluginCommandHost'
import { pluginExternalCredentialLifecycle } from '@xmcl/runtime/credential/pluginExternalCredentialLifecycle'
import { elyByPlugin } from '@xmcl/runtime/elyby/elyByPlugin'
import { pluginEncodingWorker } from '@xmcl/runtime/encoding/pluginEncodingWorker'
import {
  pluginClientToken,
  pluginFlights,
  pluginGFW,
  pluginImageStorage,
  pluginLogConsumer,
  pluginTasks,
  pluginTelemetry,
  pluginUncaughtError,
} from '@xmcl/runtime/infra/plugins'
import { pluginLaunchPrecheck } from '@xmcl/runtime/launch/pluginLaunchPrecheck'
import { pluginMarketProvider } from '@xmcl/runtime/market/pluginMarketProvider'
import { pluginNativeReplacer } from '@xmcl/runtime/nativeReplacer/pluginNativeReplacer'
import { pluginNetworkInterface } from '@xmcl/runtime/network/pluginNetworkInterface'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginSaveWorker } from '@xmcl/runtime/save/pluginSaveWorker'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { kSettings } from '@xmcl/runtime/settings'
import { pluginSetup } from '@xmcl/runtime/setup/pluginSetup'
import { pluginModrinthAccess } from '@xmcl/runtime/user/pluginModrinthAccess'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilApi } from '@xmcl/runtime/user/pluginYggdrasilApi'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'
import { pluginXmclAccountMicrosoftBridge } from '@xmcl/runtime/xmclAccount/pluginXmclAccountMicrosoftBridge'
import { pluginXmclAccountModrinthBridge } from '@xmcl/runtime/xmclAccount/pluginXmclAccountModrinthBridge'
import localeMappings from '../../assets/locales.json'
import { pluginGameLaunch } from './pluginGameLaunch'
import { pluginOptifine } from './pluginOptifine'
import { definedServices } from './services'

const pluginLocalization: LauncherAppPlugin = async (app) => {
  const settings = await app.registry.get(kSettings)
  settings.localesSet(Object.entries(localeMappings).map(([locale, name]) => ({ locale, name })))
}

export const plugins: LauncherAppPlugin[] = [
  pluginAgentProtocol,
  pluginCommandHost({ services: definedServices }),
  pluginCli,
  pluginApiFallback,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSaveWorker,
  pluginSetup,
  pluginLaunchPrecheck,
  pluginGameLaunch,
  pluginOptifine,
  pluginUncaughtError,
  pluginNativeReplacer,
  elyByPlugin,
  pluginMarketProvider,
  pluginYggdrasilApi,
  pluginMediaProtocol,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,
  pluginClientToken,
  pluginServicesHandler(definedServices),
  pluginTelemetry,
  pluginLogConsumer,
  pluginSettings,
  pluginLocalization,
  pluginGFW,
  pluginTasks,
  pluginImageStorage,
  pluginFlights,
  pluginNetworkInterface,
  pluginExternalCredentialLifecycle,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginUserTokenStorage,
  pluginModrinthAccess,
  pluginXmclAccountMicrosoftBridge,
  pluginXmclAccountModrinthBridge,
  pluginCommonProtocol,
]
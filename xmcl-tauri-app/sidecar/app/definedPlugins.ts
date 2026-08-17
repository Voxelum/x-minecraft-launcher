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
import { pluginUndiciLogger } from '@xmcl/runtime/network/pluginUndiciLogger'
import { pluginUserPlaytime } from '@xmcl/runtime/playTime/pluginUserPlaytime'
import { pluginResourceWorker } from '@xmcl/runtime/resource/pluginResourceWorker'
import { pluginResourcePackLink } from '@xmcl/runtime/resourcePack/pluginResourcePackLink'
import { pluginSaveWorker } from '@xmcl/runtime/save/pluginSaveWorker'
import { pluginServicesHandler } from '@xmcl/runtime/service/pluginServicesHandler'
import { pluginSettings } from '@xmcl/runtime/settings/pluginSettings'
import { pluginSetup } from '@xmcl/runtime/setup/pluginSetup'
import { pluginModrinthAccess } from '@xmcl/runtime/user/pluginModrinthAccess'
import { pluginOffineUser } from '@xmcl/runtime/user/pluginOfflineUser'
import { pluginOfficialUserApi } from '@xmcl/runtime/user/pluginOfficialUserApi'
import { pluginUserTokenStorage } from '@xmcl/runtime/user/pluginUserTokenStorage'
import { pluginYggdrasilApi } from '@xmcl/runtime/user/pluginYggdrasilApi'
import { pluginXmclAccountMicrosoftBridge } from '@xmcl/runtime/xmclAccount/pluginXmclAccountMicrosoftBridge'
import { pluginXmclAccountModrinthBridge } from '@xmcl/runtime/xmclAccount/pluginXmclAccountModrinthBridge'
import { pluginYggdrasilHandler } from '@xmcl/runtime/yggdrasilServer/pluginYggdrasilHandler'
import { pluginDiscreteGPULinux } from '../../../xmcl-electron-app/main/pluginDiscreteGPULinux'
import { pluginIconProtocol } from '../../../xmcl-electron-app/main/pluginIconProtocol'
import { pluginLinuxDisplay } from '../../../xmcl-electron-app/main/pluginLinuxDisplay'
import { definedServices } from './definedServices'
import { pluginAgentDocuments } from './pluginAgentDocuments'

/**
 * The plugin set of the sidecar.
 *
 * This is `xmcl-electron-app/main/definedPlugins.ts` minus the plugins that talk
 * to Electron itself. Everything reused here imports no `electron`, including
 * the ones that physically live in the Electron package
 * (`pluginIconProtocol`, `pluginLinuxDisplay`, `pluginDiscreteGPULinux`).
 *
 * `pluginAgentDocuments` is reimplemented locally because it resolved the
 * document directory from `process.resourcesPath`.
 *
 * Deliberately left out:
 * - `pluginAutoUpdate`: drives `electron-updater`. `TauriUpdater` reports
 *   updates as manual until the shell's own updater is wired up.
 * - `pluginPowerMonitor`: needs Electron's `powerMonitor` for idle/suspend
 *   detection feeding Discord presence. Its replacement belongs in the Rust
 *   shell and is not implemented yet.
 */
export const definedPlugins: LauncherAppPlugin[] = [
  pluginAgentDocuments,
  pluginAgentProtocol,
  pluginCommandHost({ services: definedServices }),
  pluginCli,
  pluginIconProtocol,
  pluginApiFallback,
  pluginResourceWorker,
  pluginEncodingWorker,
  pluginSaveWorker,
  pluginSetup,
  pluginLaunchPrecheck,
  pluginLinuxDisplay,
  pluginDiscreteGPULinux,
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
  pluginGFW,
  pluginTasks,
  pluginImageStorage,
  pluginFlights,
  pluginNetworkInterface,
  pluginExternalCredentialLifecycle,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginUndiciLogger,
  pluginUserTokenStorage,

  pluginModrinthAccess,
  pluginXmclAccountMicrosoftBridge,
  pluginXmclAccountModrinthBridge,

  pluginCommonProtocol,
]

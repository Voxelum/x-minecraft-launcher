import { pluginClientToken } from './pluginClientToken'
import { pluginCommonProtocol } from './pluginCommonProtocol'
import { pluginGFW } from './pluginGFW'
import { pluginGameDataPath } from './pluginGameDataPath'
import { pluginImageStorage } from './pluginImageStore'
import { pluginLogConsumer } from './pluginLogConsumer'
import { pluginNetworkInterface } from './pluginNetworkInterface'
import { pluginOfficialUserApi } from './pluginOfficialUserApi'
import { pluginOffineUser } from './pluginOfflineUser'
import { pluginServicesHandler } from './pluginServicesHandler'
import { pluginSettings } from './pluginSettings'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUndiciLogger } from './pluginUndiciLogger'
import { pluginUserTokenStorage } from './pluginUserTokenStorage'
import { pluginWorker } from './pluginWorker'
import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'

export const plugins = [
  pluginClientToken,
  pluginCommonProtocol,
  pluginGameDataPath,
  pluginGFW,
  pluginImageStorage,
  pluginLogConsumer,
  pluginNetworkInterface,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginServicesHandler,
  pluginSettings,
  pluginTelemetry,
  pluginUndiciLogger,
  pluginUserTokenStorage,
  pluginWorker,
  pluginYggdrasilHandler,
]

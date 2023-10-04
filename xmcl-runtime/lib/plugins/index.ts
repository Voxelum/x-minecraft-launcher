import { pluginClientToken } from './pluginClientToken'
import { pluginCommonProtocol } from './pluginCommonProtocol'
import { pluginCurseforgeClient } from './pluginCurseforgeClient'
import { pluginCurseforgeModpackHandler } from './pluginCurseforgeModpackHandler'
import { pluginGFW } from './pluginGFW'
import { pluginGameDataPath } from './pluginGameDataPath'
import { pluginImageStorage } from './pluginImageStore'
import { pluginLogConsumer } from './pluginLogConsumer'
import { pluginModrinthModpackHandler } from './pluginModrinthModpackHandler'
import { pluginNetworkInterface } from './pluginNetworkInterface'
import { pluginOfficialUserApi } from './pluginOfficialUserApi'
import { pluginOffineUser } from './pluginOfflineUser'
import { pluginResourcePackLink } from './pluginResourcePackLink'
import { pluginServicesHandler } from './pluginServicesHandler'
import { pluginSettings } from './pluginSettings'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUndiciLogger } from './pluginUndiciLogger'
import { pluginUserPlaytime } from './pluginUserPlaytime'
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
  pluginCurseforgeModpackHandler,
  pluginModrinthModpackHandler,
  pluginServicesHandler,
  pluginSettings,
  pluginTelemetry,
  pluginUndiciLogger,
  pluginUserTokenStorage,
  pluginCurseforgeClient,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginWorker,
  pluginYggdrasilHandler,
]

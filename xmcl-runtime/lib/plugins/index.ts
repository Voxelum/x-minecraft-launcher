import { pluginClientToken } from './pluginClientToken'
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
import { pluginTasks } from './pluginTasks'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUndiciLogger } from './pluginUndiciLogger'
import { pluginUserPlaytime } from './pluginUserPlaytime'
import { pluginUserTokenStorage } from './pluginUserTokenStorage'
import { pluginWorker } from './pluginWorker'
import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'
import { pluginFlights } from './pluginFlights'

export const plugins = [
  pluginClientToken,
  pluginFlights,
  pluginGameDataPath,
  pluginGFW,
  pluginTasks,
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

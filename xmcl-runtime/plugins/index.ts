import { pluginClientToken } from './pluginClientToken'
import { pluginMediaProtocol } from './pluginMediaProtocol'
import { pluginCurseforgeClient } from './pluginCurseforgeClient'
import { pluginCurseforgeModpackHandler } from './pluginCurseforgeModpackHandler'
import { pluginGFW } from './pluginGFW'
import { pluginGameDataPath } from './pluginGameDataPath'
import { pluginImageStorage } from './pluginImageStore'
import { pluginLogConsumer } from './pluginLogConsumer'
import { pluginModrinthModpackHandler } from './pluginModrinthModpackHandler'
import { pluginResourcePackLink } from './pluginResourcePackLink'
import { pluginServicesHandler } from './pluginServicesHandler'
import { pluginSettings } from './pluginSettings'
import { pluginTasks } from './pluginTasks'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUserPlaytime } from './pluginUserPlaytime'
import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'
import { pluginWorker } from '~/encoding/pluginWorker'
import { pluginFlights } from '~/flights'
import { pluginNetworkInterface } from '~/network/pluginNetworkInterface'
import { pluginUndiciLogger } from '~/network/pluginUndiciLogger'
import { pluginOfficialUserApi } from '~/user/pluginOfficialUserApi'
import { pluginOffineUser } from '~/user/pluginOfflineUser'
import { pluginUserTokenStorage } from '~/user/pluginUserTokenStorage'

export const plugins = [
  pluginClientToken,
  pluginMediaProtocol,
  pluginGameDataPath,
  pluginGFW,
  pluginTasks,
  pluginImageStorage,
  pluginLogConsumer,
  pluginCurseforgeModpackHandler,
  pluginModrinthModpackHandler,
  pluginServicesHandler,
  pluginSettings,
  pluginTelemetry,
  pluginCurseforgeClient,
  pluginResourcePackLink,
  pluginUserPlaytime,
  pluginYggdrasilHandler,

  pluginWorker,
  pluginFlights,
  pluginNetworkInterface,
  pluginOfficialUserApi,
  pluginOffineUser,
  pluginUndiciLogger,
  pluginUserTokenStorage,
]

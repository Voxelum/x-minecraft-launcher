import { pluginCommonProtocol } from './pluginCommonProtocol'
import { pluginElyAccountSystem } from './pluginElyAccountSystem'
import { pluginImageStorage } from './pluginImageStore'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUndiciLogger } from './pluginUndiciLogger'
import { pluginUserTokenStorage } from './pluginUserTokenStorage'
import { pluginWorker } from './pluginWorker'
import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'

export const plugins = [
  pluginUserTokenStorage,
  pluginYggdrasilHandler,
  pluginUndiciLogger,
  pluginWorker,
  pluginTelemetry,
  pluginImageStorage,
  pluginCommonProtocol,
  pluginElyAccountSystem,
]

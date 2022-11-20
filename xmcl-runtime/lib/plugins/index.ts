import { pluginCommonProtocol } from './pluginCommonProtocol'
import { pluginImageStorage } from './pluginImageStore'
import { pluginTelemetry } from './pluginTelemetry'
import { pluginUndiciLogger } from './pluginUndiciLogger'
import { pluginWorker } from './pluginWorker'
import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'

export const plugins = [
  pluginYggdrasilHandler,
  pluginUndiciLogger,
  pluginWorker,
  pluginTelemetry,
  pluginImageStorage,
  pluginCommonProtocol,
]

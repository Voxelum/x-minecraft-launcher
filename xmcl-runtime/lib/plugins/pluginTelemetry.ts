import { randomUUID } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { kTelemtrySession, APP_INSIGHT_KEY } from '../entities/telemetry'
import { LaunchService } from '../services/LaunchService'
import { UserService } from '../services/UserService'
import { BaseService } from '../services/BaseService'

export const pluginTelemetry: LauncherAppPlugin = async (app) => {
  if (IS_DEV) {
    return
  }
  const appInsight = await import('applicationinsights')
  const contract = new appInsight.Contracts.ContextTagKeys()

  const clientSessionFile = join(app.appDataPath, 'client_session')
  let sessionId = ''
  try {
    const session = await readFile(clientSessionFile).then(b => b.toString())
    sessionId = session
  } catch {
    sessionId = randomUUID()
    await writeFile(clientSessionFile, sessionId)
  }

  app.registry.register(kTelemtrySession, sessionId)

  appInsight.setup(APP_INSIGHT_KEY)
    .setDistributedTracingMode(appInsight.DistributedTracingModes.AI_AND_W3C)
    .setAutoCollectExceptions(true)
    .setAutoCollectConsole(false)
    .setAutoCollectPerformance(false)
    .setAutoCollectDependencies(false)
    .setAutoCollectRequests(false)
    .start()

  const tags = appInsight.defaultClient.context.tags
  tags[contract.sessionId] = sessionId
  tags[contract.userId] = sessionId
  tags[contract.applicationVersion] = `${app.version}#${app.build}`

  app.on('engine-ready', () => {
    const baseService = app.serviceManager.get(BaseService)
    process.on('uncaughtException', (e) => {
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e })
      }
    })
    process.on('unhandledRejection', (e) => {
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e as any }) // the applicationinsights will convert it to error automatically
      }
    })
    app.serviceManager.get(LaunchService)
      .on('minecraft-start', (options) => {
        if (baseService.state.disableTelemtry) return
        appInsight.defaultClient.trackEvent({
          name: 'minecraft-start',
          properties: options,
        })
      })
      .on('minecraft-exit', ({ code, signal, crashReport }) => {
        if (baseService.state.disableTelemtry) return
        const normalExit = code === 0
        const crashed = crashReport && crashReport.length > 0
        if (normalExit) {
          appInsight.defaultClient.trackEvent({
            name: 'minecraft-exit',
          })
        } else {
          appInsight.defaultClient.trackEvent({
            name: 'minecraft-exit',
            properties: {
              code,
              signal,
              crashed,
            },
          })
        }
      })

    app.serviceManager.get(UserService).on('user-login', (authService) => {
      if (baseService.state.disableTelemtry) return
      appInsight.defaultClient.trackEvent({
        name: 'user-login',
        properties: {
          authService,
        },
      })
    })
  })
}

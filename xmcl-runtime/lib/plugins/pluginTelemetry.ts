import { randomUUID } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { IS_DEV } from '../constant'
import { kTelemtrySession, APP_INSIGHT_KEY } from '../entities/telemetry'
import { LaunchService } from '../services/LaunchService'
import { UserService } from '../services/UserService'
import { BaseService } from '../services/BaseService'
import { ResourceService } from '../services/ResourceService'
import { Resource } from '@xmcl/runtime-api'

export const pluginTelemetry: LauncherAppPlugin = async (app) => {
  if (IS_DEV) {
    return
  }
  const appInsight = await import('applicationinsights')
  const contract = new appInsight.Contracts.ContextTagKeys()

  const clientSessionFile = join(app.appDataPath, 'client_session')
  let clientSession = ''
  try {
    const session = await readFile(clientSessionFile).then(b => b.toString())
    clientSession = session
  } catch {
    clientSession = randomUUID()
    await writeFile(clientSessionFile, clientSession)
  }

  const sessionId = randomUUID()

  app.registry.register(kTelemtrySession, clientSession)

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
  tags[contract.userId] = clientSession
  tags[contract.applicationVersion] = IS_DEV ? '0.0.0' : `${app.version}#${app.build}`
  tags[contract.operationParentId] = 'root'

  app.on('engine-ready', () => {
    const baseService = app.serviceManager.get(BaseService)
    process.on('uncaughtException', (e) => {
      if (baseService.state.disableTelemetry) return
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e })
      }
    })
    process.on('unhandledRejection', (e) => {
      if (baseService.state.disableTelemetry) return
      if (appInsight.defaultClient) {
        appInsight.defaultClient.trackException({ exception: e as any }) // the applicationinsights will convert it to error automatically
      }
    })
    app.serviceManager.get(LaunchService)
      .on('minecraft-start', (options) => {
        if (baseService.state.disableTelemetry) return
        appInsight.defaultClient.trackEvent({
          name: 'minecraft-start',
          properties: options,
        })
      })
      .on('minecraft-exit', ({ code, signal, crashReport }) => {
        if (baseService.state.disableTelemetry) return
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

    app.logManager.logBus.on('log', (tag, message) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackTrace({
        message,
        severity: appInsight.Contracts.SeverityLevel.Information,
        tagOverrides: {
          [contract.operationParentId]: tag,
        },
      })
    })
    app.logManager.logBus.on('error', (tag, message: string, e?: Error) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackTrace({
        message,
        severity: appInsight.Contracts.SeverityLevel.Error,
        properties: e ? { ...e } : undefined,
        tagOverrides: {
          [contract.operationParentId]: tag,
        },
      })
    })
    app.logManager.logBus.on('warn', (tag, message) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackTrace({
        message,
        severity: appInsight.Contracts.SeverityLevel.Warning,
        tagOverrides: {
          [contract.operationParentId]: tag,
        },
      })
    })

    app.serviceManager.get(ResourceService).on('resourceAdd', (res: Resource) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackEvent({
        name: 'resource-metadata',
        properties: {
          fileName: res.fileName,
          domain: res.domain,
          sha1: res.hash,
          metadata: res.metadata,
        },
      })
    }).on('resourceUpdate', (res: Resource) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackEvent({
        name: 'resource-metadata',
        properties: {
          fileName: res.fileName,
          domain: res.domain,
          sha1: res.hash,
          metadata: res.metadata,
        },
      })
    })

    app.serviceManager.get(UserService).on('user-login', (authService) => {
      if (baseService.state.disableTelemetry) return
      appInsight.defaultClient.trackEvent({
        name: 'user-login',
        properties: {
          authService,
        },
      })
    })
  })
}

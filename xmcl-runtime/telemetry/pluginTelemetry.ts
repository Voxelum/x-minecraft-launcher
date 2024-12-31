import { Exception, LaunchService as ILaunchService } from '@xmcl/runtime-api'
import type { Contracts } from 'applicationinsights'
import { randomUUID } from 'crypto'
import { LauncherAppPlugin } from '~/app'
import { kClientToken, kIsNewClient } from '~/clientToken'
import { LaunchService } from '~/launch'
import { PeerService } from '~/peer'
import { kSettings } from '~/settings'
import { UserService } from '~/user'
import { IS_DEV } from '../constant'
import { setupResourceTelemetryClient } from './ResourceTelemetryClient'
import { DEFAULT_APP_INSIGHT_KEY, parseStack } from './telemetry'

const getSdkVersion = () => {
  let sdkVersion = ''

  if (process.versions.electron) {
    sdkVersion += 'electron:' + process.versions.electron + ';'
  }
  if (process.versions.node) {
    sdkVersion += 'node:' + process.versions.node + ';'
  }
  if (process.versions.napi) {
    sdkVersion += 'napi:' + process.versions.napi + ';'
  }

  return sdkVersion
}

export const pluginTelemetry: LauncherAppPlugin = async (app) => {
  process.env.APPLICATIONINSIGHTS_CONFIGURATION_CONTENT = '{}'
  const logger = app.getLogger('Telemtry')
  const appInsight = await import('applicationinsights')
  const contract = new appInsight.Contracts.ContextTagKeys()

  const sessionId = randomUUID()

  const clientSession = await app.registry.get(kClientToken)
  const isNewClient = await app.registry.get(kIsNewClient)

  appInsight.setup(DEFAULT_APP_INSIGHT_KEY)
    .setDistributedTracingMode(appInsight.DistributedTracingModes.AI_AND_W3C)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(false)
    .setAutoCollectConsole(false)
    .setAutoCollectHeartbeat(false)
    .setAutoCollectDependencies(false)
    .setAutoCollectRequests(false)
    .start()

  const tags = appInsight.defaultClient.context.tags
  tags[contract.sessionId] = sessionId
  tags[contract.userId] = clientSession
  tags[contract.applicationVersion] = IS_DEV ? '0.0.0' : `${app.version}#${app.build}`
  tags[contract.operationParentId] = 'root'
  tags[contract.deviceModel] = app.platform.arch
  tags[contract.cloudRole] = app.env
  tags[contract.internalSdkVersion] = getSdkVersion()

  const createExceptionDetails = (msg?: string, name?: string, stack?: string) => {
    const d = new appInsight.Contracts.ExceptionDetails()
    d.message = msg?.substring(0, 32768) || ''
    d.typeName = name?.substring(0, 1024) || ''
    d.parsedStack = parseStack(stack) as any
    d.hasFullStack = (d.parsedStack instanceof Array) && d.parsedStack.length > 0
    return d
  }

  const handleException = (exception: Contracts.ExceptionData, e: Error) => {
    if (e.cause instanceof Error) {
      exception.exceptions.push(createExceptionDetails(e.cause.message, e.cause.name, e.cause.stack))
    } else if (e instanceof AggregateError || (Array.isArray((e as any).errors))) {
      for (const cause of (e as any).errors) {
        handleException(exception, cause)
      }
    }
  }

  const defaultClient = appInsight.defaultClient

  const sampled = ['UpdateMetadataError', 'NodeInternalError']

  defaultClient.addTelemetryProcessor((envelope, contextObjects) => {
    if (contextObjects?.error) {
      const exception = envelope.data.baseData as Contracts.ExceptionData
      const e = contextObjects?.error
      if (e instanceof Error) {
        handleException(exception, e)
        if (sampled.includes(e.name)) {
          // Only log 1/3 of the internal error
          envelope.sampleRate = 33
        }
      }
    }
    return true
  })

  logger.log('Telemetry client started')
  defaultClient.trackEvent({
    name: 'app-start',
    properties: {
      isNewClient,
    },
  })

  app.registryDisposer(async () => {
    defaultClient.trackEvent({
      name: 'app-stop',
    })
    await new Promise((resolve) => {
      defaultClient.flush({
        callback: resolve,
      })
    })
    appInsight.dispose()
  })

  app.on('download-cdn', (reason, file) => {
    defaultClient.trackEvent({
      name: 'download-cdn',
      properties: {
        reason,
        file,
      },
    })
  })

  app.waitEngineReady().then(async () => {
    const settings = await app.registry.get(kSettings)

    // resource data are enormous, so we need to handle them separately
    setupResourceTelemetryClient(appInsight, app, settings, appInsight.defaultClient.context.tags)

    // Track game start and end
    app.registry.get(LaunchService).then((service: LaunchService) => {
      (service as ILaunchService).on('minecraft-start', (options) => {
        if (settings.disableTelemetry) return
        defaultClient.trackEvent({
          name: 'minecraft-start',
          properties: options,
          tagOverrides: {
            [contract.operationId]: options.operationId ?? '',
          },
        })
      })
        .on('minecraft-exit', ({ code, signal, crashReport, operationId }) => {
          if (settings.disableTelemetry) return
          const normalExit = code === 0
          const crashed = crashReport && crashReport.length > 0
          if (normalExit) {
            defaultClient.trackEvent({
              name: 'minecraft-exit',
            })
          } else {
            defaultClient.trackEvent({
              name: 'minecraft-exit',
              properties: {
                code,
                signal,
                crashed,
              },
              tagOverrides: {
                [contract.operationId]: operationId ?? '',
              },
            })
          }
        }).on('launch-performance', ({ name, id, duration }) => {
          if (settings.disableTelemetry) return
          defaultClient.trackEvent({
            name,
            measurements: {
              duration,
            },
            tagOverrides: {
              [contract.operationId]: id,
              [contract.operationName]: name,
            },
          })
        }).on('launch-performance-pre', ({ name, id }) => {
          if (settings.disableTelemetry) return
          defaultClient.trackEvent({
            name: name + '-pre',
            tagOverrides: {
              [contract.operationId]: id,
              [contract.operationName]: name,
            },
          })
        })
    })

    app.logEmitter.on('failure', (destination, tag, e: Error) => {
      if (settings.disableTelemetry) return
      if (e instanceof Exception) {
        // Skip for exception
        return
      }
      defaultClient.trackException({
        exception: e,
        properties: e ? { ...e } : undefined,
        contextObjects: {
          error: e,
        },
        tagOverrides: {
          [contract.operationParentId]: tag,
        },
      })
    })

    // Track user authority
    app.registry.get(UserService).then(service => {
      service.on('user-login', (authority) => {
        if (settings.disableTelemetry) return
        defaultClient.trackEvent({
          name: 'user-login',
          properties: {
            authService: authority,
          },
        })
      })
    })

    // Track peer connection quality
    app.registry.get(PeerService).then(service => {
      service.getPeerState().then(state => {
        state.subscribe('connectionStateChange', (state) => {
          if (state.connectionState === 'connected') {
            defaultClient.trackEvent({
              name: 'peer-connection-connected',
            })
          }
        })
        state.subscribe('connectionAdd', (conn) => {
          defaultClient.trackEvent({
            name: 'peer-connection-add',
          })
        })
      })
    })
  })
}

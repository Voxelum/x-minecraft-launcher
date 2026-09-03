import { UpdateResourcePayload } from '@xmcl/resource'
import {
  AGENT_TELEMETRY_FLIGHT,
  APP_INSIGHT_KEY,
  Exception,
  LaunchService as ILaunchService,
  type RendererActionEnd,
  type RendererActionStart,
  type RendererExceptionTelemetry,
  type XmclAccountSnapshot,
} from '@xmcl/runtime-api'
import {
  AzureMonitorLogExporter,
  AzureMonitorTraceExporter,
} from '@azure/monitor-opentelemetry-exporter'
import { logs } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { BatchSpanProcessor, ParentBasedSampler } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { randomUUID } from 'crypto'
import { LauncherAppPlugin } from '~/app'
import { IS_DEV } from '~/constant'
import {
  kClientToken,
  kFlights,
  kIsNewClient,
  classifyExternalProvider,
  launcherSessionId,
  endRendererAction,
  isErrorTelemetryRecorded,
  runtimeTelemetry,
  startRendererAction,
  setRuntimeTelemetryEnabled,
  setRuntimeTelemetryIdentity,
  setRuntimeTelemetryUserId,
  trackCompletedSpan,
} from '~/infra'
import { takeCompletedMigrationTelemetry } from '~/app/migrate'
import { LaunchService } from '~/launch'
import { createPostprocessTelemetryTracker } from '~/install/postprocessTelemetry'
import { kResourceDatabaseTelemetry, kResourceManager } from '~/resource'
import { kSettings } from '~/settings'
import { UserService } from '~/user'
import { XmclAccountService } from '~/xmclAccount'
import { ErrorDiagnose } from '../errors/ErrorDiagnose'
import { getMinecraftExitTelemetry, getMinecraftStartTelemetry } from '../launchTelemetry'
import { setupResourceTelemetryClient } from '../telemetry_resource'
import {
  AGENT_SUCCESS_SAMPLE_RATE,
  DOWNLOAD_SESSION_SAMPLE_RATE,
  isDeterministicallySampled,
  XmclRootTraceSampler,
} from '../telemetry_sampling'

const installOperations: Record<string, ReadonlySet<string>> = {
  VersionInstallService: new Set(['install', 'installInstance']),
  InstanceInstallService: new Set(['installInstanceFiles', 'resumeInstanceInstall']),
  ModpackService: new Set(['importModpack']),
}

function getInstallOperation(serviceName: string, serviceMethod: string) {
  return installOperations[serviceName]?.has(serviceMethod)
    ? `${serviceName}.${serviceMethod}`
    : undefined
}

export const pluginTelemetry: LauncherAppPlugin = async (app) => {
  const logger = app.getLogger('Telemtry')
  const diagnose = new ErrorDiagnose(app)

  const clientSession = await app.registry.get(kClientToken)
  const isNewClient = await app.registry.get(kIsNewClient)

  const resource = resourceFromAttributes({
    'service.name': app.env,
    'service.namespace': 'xmcl',
    'service.version': IS_DEV ? '0.0.0' : `${app.version}#${app.build}`,
    'service.instance.id': launcherSessionId,
    'device.id': clientSession,
    'device.model.identifier': app.platform.arch,
    'os.type': app.platform.os,
    'os.version': app.platform.osRelease,
  })
  const traceProvider = new NodeTracerProvider({
    resource,
    sampler: new ParentBasedSampler({
      root: new XmclRootTraceSampler(),
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new AzureMonitorTraceExporter({
          connectionString: APP_INSIGHT_KEY,
        }),
      ),
    ],
  })
  traceProvider.register()
  const logProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new AzureMonitorLogExporter({
          connectionString: APP_INSIGHT_KEY,
        }),
      }),
    ],
  })
  logs.setGlobalLoggerProvider(logProvider)
  setRuntimeTelemetryIdentity(clientSession)

  app.controller.handle(
    'renderer-telemetry-exception',
    (_, payload: RendererExceptionTelemetry) => {
      if (!payload || typeof payload.name !== 'string' || typeof payload.message !== 'string') {
        throw new TypeError('Invalid renderer exception telemetry payload')
      }
      const exception = new Error(payload.message)
      exception.name = payload.name
      if (typeof payload.stack === 'string') {
        exception.stack = payload.stack
      }
      runtimeTelemetry.trackException({
        exception,
        properties: {
          ...payload.properties,
          'xmcl.client.type': 'Browser',
          'xmcl.telemetry.origin': 'renderer',
        },
      })
    },
  )
  app.controller.handle('renderer-telemetry-flush', async () => {
    await Promise.all([traceProvider.forceFlush(), logProvider.forceFlush()])
  })
  app.controller.handle('renderer-telemetry-action-start', (_, action: RendererActionStart) => {
    return startRendererAction(action)
  })
  app.controller.handle('renderer-telemetry-action-end', (_, action: RendererActionEnd) => {
    return endRendererAction(action)
  })

  logger.log('Telemetry client started')
  app.on('app-booted', () => {
    runtimeTelemetry.trackEvent({
      name: 'app-ready',
      measurements: {
        uptimeMs: process.uptime() * 1_000,
      },
    })
  })

  app.registryDisposer(async () => {
    runtimeTelemetry.trackEvent({
      name: 'app-stop',
    })
    await Promise.all([traceProvider.shutdown(), logProvider.shutdown()])
  })

  app.on('download-cdn', (reason, _file) => {
    runtimeTelemetry.trackEvent({
      name: 'download-cdn',
      properties: {
        reason: /^[a-zA-Z0-9_.-]{1,64}$/.test(reason) ? reason : 'other',
      },
    })
  })

  app.on('agent-run-trace', (payload) => {
    if (
      payload.outcome === 'completed' &&
      !isDeterministicallySampled(payload.runId, AGENT_SUCCESS_SAMPLE_RATE)
    ) {
      return
    }
    app.registry.get(kSettings).then((settings) => {
      if (settings.disableTelemetry) return
      app.registry.get(kFlights).then((flights) => {
        if (flights[AGENT_TELEMETRY_FLIGHT] !== true) return
        runtimeTelemetry.trackTrace({
          message: 'agent-run',
          properties: {
            name: 'agent-run',
            runId: payload.runId,
            agentId: payload.agentId,
            provider: payload.provider,
            model: payload.model,
            outcome: payload.outcome,
            stopReason: payload.stopReason,
            tools: JSON.stringify(payload.tools).slice(0, 2048),
            turnCount: String(payload.turnCount),
            toolCallCount: String(payload.toolCallCount),
            toolFailureCount: String(payload.toolFailureCount),
            inputTokens: String(payload.inputTokens),
            outputTokens: String(payload.outputTokens),
            durationMs: String(payload.durationMs),
          },
        })
      })
    })
  })

  app.waitEngineReady().then(async () => {
    const settings = await app.registry.get(kSettings)

    try {
      const state = await app.registry
        .get(XmclAccountService)
        .then((service) => service.getXmclAccountState())
      const setUserId = (accountId?: string) => {
        setRuntimeTelemetryUserId(accountId)
      }
      state.subscribe('snapshot', (snapshot: XmclAccountSnapshot) => {
        setUserId(snapshot.account?.accountId)
      })
      state.subscribe('guest', () => {
        setUserId()
      })
      setUserId(state.account?.accountId)
    } catch {
      logger.warn('Failed to initialize account-aware telemetry identity')
    }
    const updateTelemetryEnabled = (disableTelemetry: boolean) => {
      setRuntimeTelemetryEnabled(!disableTelemetry)
    }
    updateTelemetryEnabled(settings.disableTelemetry)
    const migration = takeCompletedMigrationTelemetry()
    if (migration) {
      trackCompletedSpan({
        name: 'data_root.migrate.execute',
        traceparent: migration.traceparent,
        startTime: migration.startTime,
        endTime: migration.endTime,
        outcome: migration.outcome,
        error: migration.error,
        properties: {
          'migration.copied_bytes': migration.copiedBytes,
          'migration.copied_files': migration.copiedFiles,
        },
      })
    }
    settings.subscribe('disableTelemetrySet', updateTelemetryEnabled)
    if (!settings.disableTelemetry) {
      runtimeTelemetry.trackEvent({
        name: 'app-start',
        properties: {
          isNewClient,
        },
        measurements: {
          uptimeMs: process.uptime() * 1_000,
        },
      })
    }

    const resourceDatabase = await app.registry.get(kResourceDatabaseTelemetry)
    runtimeTelemetry.trackEvent({
      name: 'resource-database-init',
      properties: {
        ready: resourceDatabase.ready,
        recovered: resourceDatabase.recovered,
      },
      measurements: {
        attempts: resourceDatabase.attempts,
        durationMs: resourceDatabase.durationMs,
        migrationFailures: resourceDatabase.migrationFailures,
      },
    })

    app.registry.get(kResourceManager).then((manager) => {
      manager.context.event.on(
        'resourceUpdateMetadataError',
        (payload: UpdateResourcePayload, err: any) => {
          if (settings.disableTelemetry) return
          runtimeTelemetry.trackException({
            exception: err,
            properties: {
              hasMetadata: Boolean(payload.metadata),
              uriCount: payload.uris?.length ?? 0,
              iconCount: payload.icons?.length ?? 0,
            },
          })
        },
      )
    })

    // resource data are enormous, so we need to handle them separately
    setupResourceTelemetryClient(app, settings, clientSession)

    const sampleDownloadPerformance = isDeterministicallySampled(
      launcherSessionId,
      DOWNLOAD_SESSION_SAMPLE_RATE,
    )
    app.on('download-performance', (payload) => {
      if (settings.disableTelemetry) return
      if (!sampleDownloadPerformance) return
      runtimeTelemetry.trackEvent({
        name: 'download-performance',
        properties: payload.properties,
        measurements: payload.measurements,
      })
    })

    app.on(
      'install-manifest',
      createPostprocessTelemetryTracker((payload) => {
        if (settings.disableTelemetry) return
        runtimeTelemetry.trackEvent({
          name: 'install-postprocess',
          properties: payload.properties,
          measurements: payload.measurements,
          operationId: payload.operationId,
          operationName: 'install-postprocess',
        })
      }, randomUUID),
    )

    app.on('microsoft-auth-telemetry', (payload) => {
      if (settings.disableTelemetry) return
      runtimeTelemetry.trackEvent({
        name: payload.name,
        properties: payload.properties,
        measurements: payload.measurements,
        operationId: String(payload.properties.authAttemptId),
        operationName: 'microsoft-auth',
      })
    })

    // This is the install E2E score: every renderer-initiated installation
    // operation records exactly one terminal outcome. `installInstanceFiles`
    // is intentionally included so modpack/file installs are measured beside
    // game, loader, and Java installs. No payload or local paths are sent.
    app.on('service-call-end', (serviceName, serviceMethod, duration, success, failureCategory) => {
      if (settings.disableTelemetry) return
      const operation = getInstallOperation(serviceName, serviceMethod)
      if (operation) {
        runtimeTelemetry.trackEvent({
          name: 'install-operation',
          properties: {
            schemaVersion: '2',
            operation,
            service: serviceName,
            method: serviceMethod,
            success: String(success),
            failureCategory: success ? 'none' : (failureCategory ?? 'unknown'),
          },
          measurements: {
            durationMs: duration,
          },
        })
      } else if (
        !success &&
        serviceName === 'LaunchService' &&
        serviceMethod === 'launch'
      ) {
        runtimeTelemetry.trackEvent({
          name: 'launch-operation-failed',
          properties: {
            failureCategory: failureCategory ?? 'unknown',
          },
          measurements: {
            durationMs: duration,
          },
        })
      } else if (
        !success &&
        serviceName === 'BaseService' &&
        ['checkUpdate', 'downloadUpdate', 'quitAndInstall'].includes(serviceMethod)
      ) {
        runtimeTelemetry.trackEvent({
          name: 'update-operation-failed',
          properties: {
            operation: serviceMethod,
            failureCategory: failureCategory ?? 'unknown',
          },
          measurements: {
            durationMs: duration,
          },
        })
      }
    })

    // Track game start and end
    app.registry.get(LaunchService).then((service: ILaunchService) => {
      const activeLaunches = new Map<number, { operationId?: string; startedAt: number }>()
      service
        .on('minecraft-start', (options) => {
          activeLaunches.set(options.pid, {
            operationId: options.operationId,
            startedAt: Date.now(),
          })
          if (settings.disableTelemetry) return
          runtimeTelemetry.trackEvent({
            name: 'minecraft-start',
            properties: getMinecraftStartTelemetry(options),
            operationId: options.operationId,
          })
        })
        .on('minecraft-window-ready', ({ pid }) => {
          const launch = activeLaunches.get(pid)
          if (settings.disableTelemetry || !launch) return
          runtimeTelemetry.trackEvent({
            name: 'minecraft-window-ready',
            measurements: {
              durationMs: Date.now() - launch.startedAt,
            },
            operationId: launch.operationId,
          })
        })
        .on('minecraft-exit', ({ pid, code, signal, crashReport, operationId, duration }) => {
          activeLaunches.delete(pid)
          if (settings.disableTelemetry) return
          runtimeTelemetry.trackEvent({
            name: 'minecraft-exit',
            properties: getMinecraftExitTelemetry({ code, signal, crashReport }),
            measurements: { durationMs: duration },
            operationId,
          })
        })
    })

    app.logEmitter.on('failure', (destination, tag, e: Error) => {
      if (settings.disableTelemetry) return
      if (e instanceof Exception) {
        // Skip for exception
        return
      }
      if (diagnose.processError(e)) {
        return
      }
      setImmediate(() => {
        if (settings.disableTelemetry || isErrorTelemetryRecorded(e)) return
        runtimeTelemetry.trackException({
          exception: e,
          properties: {
            loggerDestination: destination,
            loggerTag: tag,
          },
        })
      }).unref()
    })

    // Track user authority
    app.registry.get(UserService).then((service) => {
      service.on('user-login', (authority) => {
        if (settings.disableTelemetry) return
        const provider = classifyExternalProvider(authority)
        runtimeTelemetry.trackEvent({
          name: 'user-login',
          properties: {
            authService:
              provider !== 'other'
                ? provider
                : authority === 'offline'
                  ? 'offline'
                  : 'custom',
          },
        })
      })
    })
  })
}

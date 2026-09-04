import {
  ResourceDomain,
  ResourceManager,
  type ResourceMetadata,
  type ResourceState,
  type UpdateResourcePayload,
} from '@xmcl/resource'
import { kResourceManager } from '~/resource'
import { getInstanceModStateKey, Settings } from '@xmcl/runtime-api'
import { LauncherApp } from '~/app'
import { kFlights, launcherSessionId } from '~/infra'
import { InstanceService } from '~/instance'
import { JavaService } from '~/java'
import { LaunchService } from '~/launch'
import { ModMetadataService } from '~/moddb/ModMetadataService'
import { ServiceStateManager } from '~/service'
import { ResourceTelemetryBatch, type ResourceTracingPayload } from './resourceTelemetryBatch'
import { AzureMonitorLogExporter } from '@azure/monitor-opentelemetry-exporter'
import { SeverityNumber } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { IS_DEV } from '~/constant'
import {
  isDeterministicallySampled,
  RESOURCE_METADATA_SAMPLE_RATE,
} from './telemetry_sampling'

const RESOURCE_TELEMETRY_CLIENT_STRING =
  'InstrumentationKey=f0634ffa-7578-4751-8f64-581fd90bf347;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=4f19b6fd-9974-4da8-a399-77aac5b3e800'

// resource data are enormous, so we need to handle them separately
export async function setupResourceTelemetryClient(
  app: LauncherApp,
  settings: Settings,
  deviceId: string,
) {
  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      'service.name': app.env,
      'service.namespace': 'xmcl',
      'service.version': IS_DEV ? '0.0.0' : `${app.version}#${app.build}`,
      'service.instance.id': launcherSessionId,
      'device.id': deviceId,
      'device.model.identifier': app.platform.arch,
      'os.type': app.platform.os,
      'os.version': app.platform.osRelease,
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter: new AzureMonitorLogExporter({
          connectionString: RESOURCE_TELEMETRY_CLIENT_STRING,
        }),
      }),
    ],
  })
  const telemetryLogger = provider.getLogger('xmcl-resource')
  const flights = await app.registry.get(kFlights)
  const stateManager = await app.registry.get(ServiceStateManager)
  const modMetadataService = await app.registry.get(ModMetadataService)
  const logger = app.getLogger('ResourceTelemetry')

  const MAX_MESSAGE_LENGTH = 32768

  const trackTrace = (message: string, properties?: Record<string, unknown>) => {
    const totalChunks = Math.ceil(message.length / MAX_MESSAGE_LENGTH)
    for (let index = 0; index < totalChunks; index++) {
      const attributes: Record<string, string | number | boolean> = {
        deviceId,
      }
      for (const [key, value] of Object.entries(properties ?? {})) {
        attributes[key] =
          typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value
            : JSON.stringify(value)
      }
      if (totalChunks > 1) {
        attributes.chunkId = index + 1
        attributes.totalChunks = totalChunks
        attributes.originalMessageLength = message.length
      }
      telemetryLogger.emit({
        body: message.substring(index * MAX_MESSAGE_LENGTH, (index + 1) * MAX_MESSAGE_LENGTH),
        severityNumber: SeverityNumber.INFO,
        attributes,
      })
    }
  }

  const getPayload = (
    sha1: string,
    metadata: ResourceMetadata,
    name?: string,
    domain?: ResourceDomain,
  ) => {
    const trace: ResourceTracingPayload = {
      name,
      sha1,
      domain,
    }
    if (metadata.curseforge) {
      trace.curseforge = {
        projectId: metadata.curseforge.projectId,
        fileId: metadata.curseforge.fileId,
      }
    }
    if (metadata.modrinth) {
      trace.modrinth = {
        projectId: metadata.modrinth.projectId,
        versionId: metadata.modrinth.versionId,
      }
    }
    if (metadata.forge) {
      trace.forge = {
        modId: metadata.forge.modid,
        version: metadata.forge.version,
      }
    }
    if (metadata.neoforge) {
      trace.neoforge = {
        modId: metadata.neoforge.modid,
        version: metadata.neoforge.version,
      }
    }
    if (metadata.quilt) {
      trace.quilt = {
        modId: metadata.quilt.quilt_loader.id,
        version: metadata.quilt.quilt_loader.version,
      }
    }
    if (metadata.fabric) {
      if (metadata.fabric instanceof Array) {
        trace.fabric = metadata.fabric.map((f) => ({
          modId: f.id,
          version: f.version,
        }))
      } else {
        trace.fabric = [
          {
            modId: metadata.fabric.id,
            version: metadata.fabric.version,
          },
        ]
      }
    }

    return trace
  }

  const resourceTelemetry = new ResourceTelemetryBatch(
    (sha1s) => modMetadataService.getLocalMetadataFactsFromSha1s(sha1s),
    (item) => {
      if (settings.disableTelemetry) return
      trackTrace(item.message, item.properties)
    },
    (error) =>
      logger.warn(
        'Failed to query the local mod metadata database for telemetry deduplication.',
        error,
      ),
    1_000,
    256,
    (payload) =>
      isDeterministicallySampled(payload.sha1.toLowerCase(), RESOURCE_METADATA_SAMPLE_RATE),
  )

  let javaService: JavaService | undefined
  app.registry.get(JavaService).then((service) => {
    javaService = service
  })
  let instanceService: InstanceService | undefined
  app.registry.get(InstanceService).then((service) => {
    instanceService = service
  })

  // Collect resource metadata
  app.registry.get(kResourceManager).then((manager) => {
    manager.context.event.on(
      'resourceParsed',
      (sha1: string, domain: ResourceDomain, metadata: ResourceMetadata) => {
        if (settings.disableTelemetry) return
        resourceTelemetry.enqueue(getPayload(sha1, metadata, undefined, domain))
      },
    )
    manager.context.event.on('resourceUpdate', (payloads: UpdateResourcePayload[]) => {
      if (settings.disableTelemetry) return
      for (const payload of payloads) {
        if (payload.metadata) {
          const copy = { ...payload.metadata } as any
          for (const key of Object.keys(copy)) {
            if (copy[key] === undefined || copy[key] === null) {
              delete copy[key]
            }
          }
          if (Object.keys(copy).length > 0) {
            resourceTelemetry.enqueue(getPayload(payload.hash, copy, copy.name), {
              name: 'resource-metadata',
            })
          }
        }
      }
    })
  })

  // Collect runt metadata
  app.registry.get(LaunchService).then((service) => {
    if (!flights.disableMinecraftRunLog) {
      service.registerMiddleware({
        name: 'minecraft-run-telemetry',
        async onBeforeLaunch(_, payload, ctx) {
          const path =
            payload.side === 'client'
              ? payload.options.gamePath
              : (payload.options.extraExecOption!.cwd as string)
          const state = stateManager.get<ResourceState>(getInstanceModStateKey(path))
          const mods = state?.files.map((m) => m.hash)
          const runtime = instanceService?.state.all[path]?.runtime
          if (mods) {
            ctx.mods = mods
            ctx.runtime = runtime
          }
        },
        async onAfterLaunch(result, input, opt, ctx) {
          if (result.code !== 0) {
            return
          }
          if (ctx.mods) {
            // client.trackTrace({
            //   message: JSON.stringify({
            //     mods: ctx.mods.join(','),
            //     runtime: ctx.runtime,
            //     java: await javaService?.getJavaState().then((javaState) => {
            //       const javaVersion = javaState.all.find(s => s.path === opt.options.javaPath)
            //       if (javaVersion) {
            //         return {
            //           majorVersion: javaVersion.majorVersion,
            //           version: javaVersion.version,
            //         }
            //       }
            //     }),
            //   }),
            //   properties: {
            //     name: 'minecraft-run-record-v2',
            //   }
            // })
          }
        },
      })
    }
  })

  app.registryDisposer(async () => {
    await resourceTelemetry.dispose()
    await provider.shutdown()
  })
}

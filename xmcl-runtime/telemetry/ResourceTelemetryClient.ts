import { getInstanceModStateKey, ResourceDomain, ResourceMetadata, ResourceState, Settings, UpdateResourcePayload } from '@xmcl/runtime-api'
import { LauncherApp } from '~/app'
import { kFlights } from '~/flights'
import { InstanceService } from '~/instance'
import { JavaService } from '~/java'
import { LaunchService } from '~/launch'
import { ResourceManager } from '~/resource'
import { ServiceStateManager } from '~/service'

const RESOURCE_TELEMETRY_CLIENT_STRING = 'InstrumentationKey=f0634ffa-7578-4751-8f64-581fd90bf347;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=4f19b6fd-9974-4da8-a399-77aac5b3e800'

// resource data are enormous, so we need to handle them separately
export async function setupResourceTelemetryClient(appInsight: typeof import('applicationinsights'), app: LauncherApp, settings: Settings, tags: Record<string, string>) {
  const client = new appInsight.TelemetryClient(RESOURCE_TELEMETRY_CLIENT_STRING)
  const flights = await app.registry.get(kFlights)
  const stateManager = await app.registry.get(ServiceStateManager)


  const MAX_MESSAGE_LENGTH = 32768;

  client.addTelemetryProcessor((envelope) => {
    if (envelope.data.baseType === "MessageData") {
      const messageData = envelope.data.baseData;

      if (!messageData) {
        return false;
      }

      if (messageData.message.length > MAX_MESSAGE_LENGTH) {
        const originalMessage = messageData.message;
        const chunkSize = MAX_MESSAGE_LENGTH;
        const totalChunks = Math.ceil(originalMessage.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const chunk = originalMessage.substring(i * chunkSize, (i + 1) * chunkSize);

          client.trackTrace({
            message: chunk,
            severity: messageData.severityLevel,
            properties: {
              ...messageData.properties,
              chunkId: i + 1,
              totalChunks: totalChunks,
              originalMessageLength: originalMessage.length,
            },
          });
        }

        return false;
      }
    }

    return true;
  })


  client.context.tags = {
    ...tags,
  }

  const getPayload = (sha1: string, metadata: ResourceMetadata, name?: string, domain?: ResourceDomain) => {
    interface ResourceTracingPayload {
      name?: string
      sha1: string
      domain?: ResourceDomain
      forge?: {
        modId: string
        version: string
      }
      fabric?: {
        modId: string
        version: string
      }[]
      neoforge?: {
        modId: string
        version: string
      }
      quilt?: {
        modId: string
        version: string
      }
      curseforge?: {
        projectId: number
        fileId: number
      }
      modrinth?: {
        projectId: string
        versionId: string
      }
    }
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
        trace.fabric = metadata.fabric.map(f => ({
          modId: f.id,
          version: f.version,
        }))
      } else {
        trace.fabric = [{
          modId: metadata.fabric.id,
          version: metadata.fabric.version,
        }]
      }
    }

    return trace
  }

  let javaService: JavaService | undefined
  app.registry.get(JavaService).then(service => {
    javaService = service
  })
  let instanceService: InstanceService | undefined
  app.registry.get(InstanceService).then(service => {
    instanceService = service
  })

  // Collect resource metadata
  app.registry.get(ResourceManager).then((manager) => {
    manager.context.eventBus.on('resourceUpdateMetadataError', (payload: UpdateResourcePayload, err: any) => {
      if (settings.disableTelemetry) return
      client.trackException({
        exception: err,
        properties: {
          ...payload,
        },
      })
    })
    manager.context.eventBus.on('resourceParsed', (sha1: string, domain: ResourceDomain, metadata: ResourceMetadata) => {
      if (settings.disableTelemetry) return
      client.trackTrace({
        message: JSON.stringify(getPayload(sha1, metadata, undefined, domain)),
      })
    })
    manager.context.eventBus.on('resourceUpdate', (payloads: UpdateResourcePayload[]) => {
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
            client.trackTrace({
              message: JSON.stringify(getPayload(payload.hash, copy, copy.name)),
              properties: {
                name: 'resource-metadata',
              }
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
          const path = payload.side === 'client' ? payload.options.gamePath : payload.options.extraExecOption!.cwd as string
          const state = stateManager.get<ResourceState>(getInstanceModStateKey(path))
          const mods = state?.files.map(m => m.hash)
          const runtime = instanceService?.state.all[path]?.runtime
          if (mods) {
            ctx.mods = mods
            ctx.runtime = runtime
          }
        },
        async onAfterLaunch(result, opt, ctx) {
          if (result.code !== 0) {
            return
          }
          if (ctx.mods) {
            client.trackTrace({
              message: JSON.stringify({
                mods: ctx.mods.join(','),
                runtime: ctx.runtime,
                java: await javaService?.getJavaState().then((javaState) => {
                  const javaVersion = javaState.all.find(s => s.path === opt.options.javaPath)
                  if (javaVersion) {
                    return {
                      majorVersion: javaVersion.majorVersion,
                      version: javaVersion.version,
                    }
                  }
                }),
              }),
              properties: {
                name: 'minecraft-run-record-v2',
              }
            })
          }
        },
      })
    }
  })

  app.registryDisposer(async () => {
    await new Promise((resolve) => {
      client.flush({
        callback: resolve,
      })
    })
    appInsight.dispose()
  })
}

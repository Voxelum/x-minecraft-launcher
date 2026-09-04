import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  TraceFlags,
} from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  endRendererAction,
  classifyExternalProvider,
  getActiveRendererActionId,
  getActiveTraceparent,
  isErrorTelemetryRecorded,
  markErrorTelemetryRecorded,
  runWithInternalSpan,
  runWithExternalHttpTrace,
  runWithRendererServiceTrace,
  setRuntimeTelemetryEnabled,
  startRendererAction,
  trackCompletedSpan,
  trackRuntimeExceptionOnce,
} from './telemetry_context'

describe('runtime service tracing', () => {
  const exporter = new InMemorySpanExporter()
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })
  const logExporter = new InMemoryLogRecordExporter()
  const logProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
  })

  beforeAll(() => {
    provider.register()
    logs.setGlobalLoggerProvider(logProvider)
  })

  beforeEach(() => {
    exporter.reset()
    logExporter.reset()
    setRuntimeTelemetryEnabled(true)
  })

  afterEach(() => {
    setRuntimeTelemetryEnabled(false)
  })

  afterAll(async () => {
    await provider.shutdown()
    await logProvider.shutdown()
    trace.disable()
    context.disable()
    propagation.disable()
    logs.disable()
  })

  it('continues the renderer W3C trace across the IPC service boundary', async () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c'
    const clientSpanId = 'b7ad6b7169203331'

    await runWithRendererServiceTrace(
      {
        traceparent: `00-${traceId}-${clientSpanId}-01`,
        tracestate: 'xmcl=test',
        actionId: 'renderer-action',
      },
      'InstanceService',
      'getInstance',
      async () => 'result',
    )

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(2)

    const clientSpan = spans.find((span) => span.kind === SpanKind.CLIENT)!
    const serviceSpan = spans.find((span) => span.kind === SpanKind.SERVER)!
    expect(clientSpan.name).toBe('InstanceService.getInstance')
    expect(clientSpan.spanContext().traceId).toBe(traceId)
    expect(clientSpan.parentSpanContext?.spanId).toBe(clientSpanId)
    expect(clientSpan.parentSpanContext?.isRemote).toBe(true)
    expect(clientSpan.attributes).toMatchObject({
      'rpc.system': 'electron.ipc',
      'rpc.service': 'InstanceService',
      'rpc.method': 'getInstance',
      'xmcl.client.type': 'Browser',
      'xmcl.telemetry.origin': 'renderer',
    })

    expect(serviceSpan.name).toBe('InstanceService.getInstance')
    expect(serviceSpan.kind).toBe(SpanKind.SERVER)
    expect(serviceSpan.spanContext().traceId).toBe(traceId)
    expect(serviceSpan.parentSpanContext?.spanId).toBe(clientSpan.spanContext().spanId)
    expect(serviceSpan.parentSpanContext?.isRemote).not.toBe(true)
    expect(serviceSpan.attributes).toMatchObject({
      'rpc.system': 'electron.ipc',
      'rpc.service': 'InstanceService',
      'rpc.method': 'getInstance',
    })
  })

  it('starts a runtime root for renderer calls without an action', async () => {
    const rendererTraceId = '0af7651916cd43dd8448eb211c80319c'
    await runWithRendererServiceTrace(
      {
        traceparent: `00-${rendererTraceId}-b7ad6b7169203331-01`,
      },
      'InstanceService',
      'getInstance',
      async () => 'result',
    )

    const spans = exporter.getFinishedSpans()
    const clientSpan = spans.find((span) => span.kind === SpanKind.CLIENT)!
    const serviceSpan = spans.find((span) => span.kind === SpanKind.SERVER)!
    expect(clientSpan.parentSpanContext).toBeUndefined()
    expect(clientSpan.spanContext().traceId).not.toBe(rendererTraceId)
    expect(serviceSpan.parentSpanContext?.spanId).toBe(clientSpan.spanContext().spanId)
  })

  it('parents all service spans under the renderer user action', async () => {
    const action = startRendererAction({
      name: 'user_action.minecraft.launch',
      attributes: { 'game.side': 'client' },
    })!
    await runWithRendererServiceTrace(
      { traceparent: action.traceparent, actionId: action.id },
      'LaunchService',
      'launch',
      async () => ({ result: 42 }),
    )
    expect(endRendererAction({ id: action.id, outcome: 'success' })).toBe(true)

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(3)

    const actionSpan = spans.find((span) => span.kind === SpanKind.INTERNAL)!
    const clientSpan = spans.find((span) => span.kind === SpanKind.CLIENT)!
    const serviceSpan = spans.find((span) => span.kind === SpanKind.SERVER)!
    expect(actionSpan.name).toBe('user_action.minecraft.launch')
    expect(actionSpan.attributes).toMatchObject({
      'game.side': 'client',
      'xmcl.action.outcome': 'success',
      'xmcl.client.type': 'Browser',
    })
    expect(clientSpan.spanContext().traceId).toBe(actionSpan.spanContext().traceId)
    expect(clientSpan.parentSpanContext?.spanId).toBe(actionSpan.spanContext().spanId)
    expect(serviceSpan.parentSpanContext?.spanId).toBe(clientSpan.spanContext().spanId)
  })

  it('records launch phases as internal children of the service span', async () => {
    const action = startRendererAction({
      name: 'user_action.minecraft.launch',
    })!
    await runWithRendererServiceTrace(
      { traceparent: action.traceparent, actionId: action.id },
      'LaunchService',
      'launch',
      async () => {
        await runWithInternalSpan(
          'launch.resolve_version',
          async () => undefined,
          { 'launch.phase': 'resolve_version' },
        )
      },
    )
    expect(endRendererAction({ id: action.id, outcome: 'success' })).toBe(true)

    const spans = exporter.getFinishedSpans()
    const serviceSpan = spans.find(
      (span) => span.name === 'LaunchService.launch' && span.kind === SpanKind.SERVER,
    )!
    const phaseSpan = spans.find((span) => span.name === 'launch.resolve_version')!
    expect(phaseSpan.kind).toBe(SpanKind.INTERNAL)
    expect(phaseSpan.parentSpanContext?.spanId).toBe(serviceSpan.spanContext().spanId)
    expect(phaseSpan.attributes['launch.phase']).toBe('resolve_version')
  })

  it('marks a failed internal phase without duplicating exception events', async () => {
    await expect(
      runWithInternalSpan('launch.spawn_process', async () => {
        throw new Error('spawn failed')
      }),
    ).rejects.toThrow('spawn failed')

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.events).toHaveLength(0)
  })

  it('records privacy-safe external HTTP dependency spans', async () => {
    const response = new Response('', {
      status: 200,
      headers: { 'content-length': '12' },
    })
    await runWithExternalHttpTrace(
      'https://api.modrinth.com/v2/project/private-query?token=secret',
      { method: 'post' },
      async () => response,
    )

    const [span] = exporter.getFinishedSpans()
    expect(span.name).toBe('http.request')
    expect(span.kind).toBe(SpanKind.CLIENT)
    expect(span.attributes).toMatchObject({
      'http.request.method': 'POST',
      'http.response.status_code': 200,
      'http.response.body.size': 12,
      'xmcl.network.provider': 'modrinth',
    })
    expect(JSON.stringify(span.attributes)).not.toContain('secret')
  })

  it('classifies external providers without retaining hostnames', () => {
    expect(classifyExternalProvider('https://cdn.modrinth.com/data/file.jar')).toBe('modrinth')
    expect(classifyExternalProvider('https://private.example.com/api')).toBe('other')
  })

  it('links completed work from a restarted process to the originating service trace', async () => {
    const action = startRendererAction({
      name: 'user_action.data_root.migrate',
    })!
    let serviceTraceparent: string | undefined
    await runWithRendererServiceTrace(
      { traceparent: action.traceparent, actionId: action.id },
      'BaseService',
      'migrate',
      async () => {
        expect(getActiveRendererActionId()).toBe(action.id)
        serviceTraceparent = getActiveTraceparent()
      },
    )
    expect(endRendererAction({ id: action.id, outcome: 'success' })).toBe(true)

    const startTime = Date.now() - 1_000
    trackCompletedSpan({
      name: 'data_root.migrate.execute',
      traceparent: serviceTraceparent,
      startTime,
      endTime: startTime + 500,
      outcome: 'success',
      properties: { 'migration.copied_files': 3 },
    })

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(4)
    const actionSpan = spans.find((span) => span.name === 'user_action.data_root.migrate')!
    const serviceSpan = spans.find(
      (span) => span.name === 'BaseService.migrate' && span.kind === SpanKind.SERVER,
    )!
    const migrationSpan = spans.find((span) => span.name === 'data_root.migrate.execute')!
    expect(migrationSpan.spanContext().traceId).toBe(actionSpan.spanContext().traceId)
    expect(migrationSpan.parentSpanContext?.spanId).toBe(serviceSpan.spanContext().spanId)
    expect(migrationSpan.attributes).toMatchObject({
      'migration.copied_files': 3,
      'xmcl.action.outcome': 'success',
    })
  })

  it('marks a remote service failure on the action without recording it twice', () => {
    const action = startRendererAction({
      name: 'user_action.instance.install',
    })!
    expect(
      endRendererAction({
        id: action.id,
        outcome: 'error',
        error: {
          name: 'InstallError',
          message: 'runtime failed',
          stack: 'remote stack',
          origin: 'runtime-service',
        },
      }),
    ).toBe(true)

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).not.toBe(0)
    expect(span.events).toHaveLength(0)
  })

  it('marks errors whose exception telemetry is already owned by a span', () => {
    const error = new Error('failed')
    expect(isErrorTelemetryRecorded(error)).toBe(false)
    markErrorTelemetryRecorded(error)
    expect(isErrorTelemetryRecorded(error)).toBe(true)
  })

  it('exports a canonical exception log even for an unsampled trace', () => {
    const error = new Error('failed once')
    const unsampledContext = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: '0af7651916cd43dd8448eb211c80319c',
      spanId: 'b7ad6b7169203331',
      traceFlags: TraceFlags.NONE,
    })

    context.with(unsampledContext, () => {
      expect(trackRuntimeExceptionOnce(error, { 'rpc.service': 'ExampleService' })).toBe(true)
      expect(trackRuntimeExceptionOnce(error, { 'rpc.service': 'ExampleService' })).toBe(false)
    })

    const records = logExporter.getFinishedLogRecords()
    expect(records).toHaveLength(1)
    expect(records[0].spanContext?.traceFlags).toBe(TraceFlags.NONE)
    expect(records[0].attributes).toMatchObject({
      'exception.type': 'Error',
      'exception.message': 'failed once',
      'rpc.service': 'ExampleService',
    })
  })
})

import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setRuntimeTelemetryEnabled } from '../telemetry_context'
import { type Tasks, kTasks } from '../task'
import { pluginTasks } from './task'

describe('task telemetry', () => {
  const exporter = new InMemorySpanExporter()
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })

  beforeAll(() => provider.register())
  beforeEach(() => {
    exporter.reset()
    setRuntimeTelemetryEnabled(true)
  })
  afterEach(() => setRuntimeTelemetryEnabled(false))
  afterAll(async () => {
    await provider.shutdown()
    trace.disable()
    context.disable()
    propagation.disable()
  })

  function createTasks() {
    const registrations = new Map<unknown, unknown>()
    const app = {
      controller: {
        broadcast() {},
        handle() {},
      },
      getLogger: () => ({ log() {}, warn() {} }),
      registry: {
        register(key: unknown, value: unknown) {
          registrations.set(key, value)
        },
      },
    }
    pluginTasks(app as any, {} as any)
    return registrations.get(kTasks) as Tasks
  }

  it('records safe task type, operation, concurrency and success', () => {
    const task = createTasks().create({
      type: 'downloaUpdate',
      key: 'private-path-must-not-be-exported',
      operation: 'asar',
      version: 'private-version',
    } as any)

    task.complete()

    const [span] = exporter.getFinishedSpans()
    expect(span.name).toBe('task.execute')
    expect(span.attributes).toMatchObject({
      'task.type': 'downloaUpdate',
      'task.operation': 'asar',
      'task.concurrent': 1,
      'task.outcome': 'success',
    })
    expect(JSON.stringify(span.attributes)).not.toContain('private')
  })

  it('marks a failed task without recording a duplicate exception', () => {
    const task = createTasks().create({
      type: 'install',
      key: 'install',
    } as any)

    task.fail(new Error('failed'))

    const [span] = exporter.getFinishedSpans()
    expect(span.status.code).toBe(SpanStatusCode.ERROR)
    expect(span.attributes['error.type']).toBe('Error')
    expect(span.events).toHaveLength(0)
  })
})

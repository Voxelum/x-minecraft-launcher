import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  TraceFlags,
  context,
  createContextKey,
  propagation,
  trace,
  type Attributes,
  type Context,
  type Span,
} from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import type {
  RendererActionContext,
  RendererActionEnd,
  RendererActionStart,
  ServiceCallTraceContext,
} from '@xmcl/runtime-api'
import { createHash, randomUUID } from 'crypto'

export const launcherSessionId = randomUUID()

const logger = logs.getLogger('xmcl-runtime')
const tracer = trace.getTracer('xmcl-runtime')

let enabled = false
let deviceId = ''
let userId = ''
const rendererActions = new Map<string, { span: Span; timeout: NodeJS.Timeout }>()
const rendererActionIdKey = createContextKey('xmcl.renderer.action.id')
const telemetryRecordedKey = Symbol.for('xmcl.telemetry.recorded')

type TelemetryProperties = object

export interface RuntimeEventTelemetry {
  name: string
  properties?: TelemetryProperties
  measurements?: Record<string, number>
  operationId?: string
  operationName?: string
}

export interface RuntimeTraceTelemetry {
  message: string
  properties?: TelemetryProperties
}

export interface RuntimeExceptionTelemetry {
  exception: unknown
  properties?: TelemetryProperties
}

export function setRuntimeTelemetryEnabled(value: boolean) {
  if (enabled && !value) {
    for (const id of rendererActions.keys()) {
      endRendererAction({ id, outcome: 'cancelled', attributes: { reason: 'telemetry-disabled' } })
    }
  }
  enabled = value
}

export function isRuntimeTelemetryEnabled() {
  return enabled
}

export function markErrorTelemetryRecorded(error: Error) {
  Object.defineProperty(error, telemetryRecordedKey, {
    configurable: true,
    value: true,
  })
}

export function isErrorTelemetryRecorded(error: unknown) {
  return (
    error instanceof Error &&
    (error as Error & { [telemetryRecordedKey]?: boolean })[telemetryRecordedKey] === true
  )
}

export function trackRuntimeExceptionOnce(
  error: unknown,
  properties?: TelemetryProperties,
) {
  let exception: Error
  if (error instanceof Error) {
    exception = error
  } else {
    let message: string
    try {
      message = typeof error === 'string' ? error : JSON.stringify(error)
    } catch {
      message = String(error)
    }
    exception = new Error(message)
  }
  if (isErrorTelemetryRecorded(exception)) return false
  markErrorTelemetryRecorded(exception)
  runtimeTelemetry.trackException({ exception, properties })
  return true
}

export function setRuntimeTelemetryIdentity(nextDeviceId: string, nextUserId?: string) {
  deviceId = nextDeviceId
  userId = nextUserId ?? `device:${nextDeviceId}`
}

export function setRuntimeTelemetryUserId(nextUserId?: string) {
  userId = nextUserId ?? `device:${deviceId}`
}

function serializeAttribute(value: unknown): string | number | boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function createAttributes(properties?: TelemetryProperties): Attributes {
  const attributes: Attributes = {
    'session.id': launcherSessionId,
    deviceId,
    'enduser.pseudo.id': userId,
  }
  for (const [key, value] of Object.entries(properties ?? {})) {
    const serialized = serializeAttribute(value)
    if (serialized !== undefined) attributes[key] = serialized
  }
  return attributes
}

function toTraceId(operationId: string) {
  const compact = operationId.replaceAll('-', '').toLowerCase()
  if (/^[0-9a-f]{32}$/.test(compact) && compact !== '00000000000000000000000000000000') {
    return compact
  }
  return createHash('sha256').update(operationId).digest('hex').slice(0, 32)
}

function createOperationContext(operationId?: string): Context | undefined {
  if (!operationId) return undefined
  const traceId = toTraceId(operationId)
  const spanId = createHash('sha256').update(`xmcl:${operationId}`).digest('hex').slice(0, 16)
  return trace.setSpanContext(ROOT_CONTEXT, {
    traceId,
    spanId,
    traceFlags: TraceFlags.SAMPLED,
    isRemote: false,
  })
}

export const runtimeTelemetry = {
  trackEvent(telemetry: RuntimeEventTelemetry) {
    if (!enabled) return
    const attributes = createAttributes(telemetry.properties)
    attributes['microsoft.custom_event.name'] = telemetry.name
    if (telemetry.operationName) {
      attributes['ai.operation.name'] = telemetry.operationName
    }
    logger.emit({
      body: telemetry.measurements ? { measurements: telemetry.measurements } : telemetry.name,
      severityNumber: SeverityNumber.INFO,
      attributes,
      context: createOperationContext(telemetry.operationId),
    })
  },
  trackTrace(telemetry: RuntimeTraceTelemetry) {
    if (!enabled) return
    logger.emit({
      body: telemetry.message,
      severityNumber: SeverityNumber.INFO,
      attributes: createAttributes(telemetry.properties),
    })
  },
  trackException(telemetry: RuntimeExceptionTelemetry) {
    if (!enabled) return
    const exception =
      telemetry.exception instanceof Error
        ? telemetry.exception
        : new Error(
            typeof telemetry.exception === 'string'
              ? telemetry.exception
              : JSON.stringify(telemetry.exception),
          )
    logger.emit({
      body: exception.message,
      severityNumber: SeverityNumber.ERROR,
      attributes: createAttributes({
        ...telemetry.properties,
        'exception.type': exception.name,
        'exception.message': exception.message,
        'exception.stacktrace': exception.stack ?? `${exception.name}: ${exception.message}`,
      }),
    })
  },
}

export function startRendererAction(
  action: RendererActionStart,
): RendererActionContext | undefined {
  if (!enabled) return undefined
  if (!/^user_action\.[a-z0-9_.-]{1,80}$/.test(action.name)) {
    throw new TypeError(`Invalid renderer action name: ${action.name}`)
  }

  const span = tracer.startSpan(action.name, {
    kind: SpanKind.INTERNAL,
    attributes: createAttributes({
      ...action.attributes,
      'xmcl.client.type': 'Browser',
      'xmcl.telemetry.origin': 'renderer',
    }),
  })
  const id = randomUUID()
  const timeout = setTimeout(
    () => {
      endRendererAction({
        id,
        outcome: 'error',
        error: {
          name: 'RendererActionTimeoutError',
          message: `Renderer action ${action.name} did not finish within 30 minutes`,
        },
      })
    },
    30 * 60 * 1_000,
  )
  timeout.unref()
  rendererActions.set(id, { span, timeout })

  const spanContext = span.spanContext()
  const traceFlags =
    (spanContext.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED ? '01' : '00'
  return {
    id,
    traceparent: `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`,
  }
}

export function endRendererAction(action: RendererActionEnd) {
  const active = rendererActions.get(action.id)
  if (!active) return false

  rendererActions.delete(action.id)
  clearTimeout(active.timeout)
  active.span.setAttributes(
    createAttributes({
      ...action.attributes,
      'xmcl.action.outcome': action.outcome,
    }),
  )
  if (action.outcome === 'error') {
    const error = new Error(action.error?.message ?? 'Renderer action failed')
    error.name = action.error?.name ?? 'RendererActionError'
    if (action.error?.stack) error.stack = action.error.stack
    if (action.error?.origin === 'runtime-service') {
      active.span.setStatus({ code: SpanStatusCode.ERROR })
    } else {
      active.span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      active.span.recordException(error)
    }
  }
  active.span.end()
  return true
}

export function getActiveRendererActionId() {
  return context.active().getValue(rendererActionIdKey) as string | undefined
}

export function getActiveTraceparent() {
  const active = trace.getSpanContext(context.active())
  if (!active || !trace.isSpanContextValid(active)) return undefined
  const traceFlags = (active.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED ? '01' : '00'
  return `00-${active.traceId}-${active.spanId}-${traceFlags}`
}

export function startRuntimeInternalSpan(name: string, attributes?: TelemetryProperties) {
  if (!enabled) return undefined
  return tracer.startSpan(
    name,
    {
      kind: SpanKind.INTERNAL,
      attributes: createAttributes(attributes),
    },
    context.active(),
  )
}

export function setActiveSpanAttributes(attributes: TelemetryProperties) {
  trace.getActiveSpan()?.setAttributes(createAttributes(attributes))
}

export function classifyExternalProvider(input: string | URL) {
  let hostname: string
  try {
    hostname = new URL(input).hostname.toLowerCase()
  } catch {
    return 'other'
  }
  const matches = (...suffixes: string[]) =>
    suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))

  if (matches('modrinth.com')) return 'modrinth'
  if (matches('curseforge.com', 'forgecdn.net')) return 'curseforge'
  if (matches('mojang.com', 'minecraft.net')) return 'mojang'
  if (matches('microsoft.com', 'microsoftonline.com', 'xboxlive.com')) return 'microsoft'
  if (matches('fabricmc.net')) return 'fabric'
  if (matches('minecraftforge.net')) return 'forge'
  if (matches('neoforged.net')) return 'neoforge'
  if (matches('github.com', 'githubusercontent.com')) return 'github'
  if (matches('xmcl.app', 'azurewebsites.net')) return 'xmcl'
  if (matches('bmclapi2.bangbang93.com')) return 'bmclapi'
  if (matches('littleskin.cn')) return 'littleskin'
  if (matches('ely.by')) return 'elyby'
  return 'other'
}

interface HttpResponseLike {
  status: number
  headers?: { get(name: string): string | null }
}

export async function runWithExternalHttpTrace<T extends HttpResponseLike>(
  input: string | URL | { url: string; method?: string },
  init: { method?: string } | undefined,
  operation: (span?: Span) => Promise<T>,
): Promise<T> {
  if (!enabled) return operation()

  const url = typeof input === 'string' || input instanceof URL ? input : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : undefined) ?? 'GET').toUpperCase()
  return tracer.startActiveSpan(
    'http.request',
    {
      kind: SpanKind.CLIENT,
      attributes: createAttributes({
        'http.request.method': method,
        'xmcl.network.provider': classifyExternalProvider(url),
      }),
    },
    async (span) => {
      try {
        const response = await operation(span)
        span.setAttribute('http.response.status_code', response.status)
        const contentLength = Number(response.headers?.get('content-length'))
        if (Number.isFinite(contentLength) && contentLength >= 0) {
          span.setAttribute('http.response.body.size', contentLength)
        }
        if (response.status >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR })
        }
        return response
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        span.setAttribute(
          'error.type',
          error instanceof Error ? error.name : typeof error,
        )
        throw error
      } finally {
        span.end()
      }
    },
  )
}

export interface CompletedSpanTelemetry {
  name: string
  traceparent?: string
  startTime: number
  endTime: number
  outcome: 'success' | 'error'
  error?: { name: string; message: string; stack?: string }
  properties?: TelemetryProperties
}

export function trackCompletedSpan(telemetry: CompletedSpanTelemetry) {
  if (!enabled) return
  const parentContext = telemetry.traceparent
    ? propagation.extract(ROOT_CONTEXT, { traceparent: telemetry.traceparent })
    : ROOT_CONTEXT
  const span = tracer.startSpan(
    telemetry.name,
    {
      kind: SpanKind.INTERNAL,
      startTime: telemetry.startTime,
      attributes: createAttributes({
        ...telemetry.properties,
        'xmcl.action.outcome': telemetry.outcome,
      }),
    },
    parentContext,
  )
  if (telemetry.outcome === 'error') {
    const error = new Error(telemetry.error?.message ?? 'Operation failed')
    error.name = telemetry.error?.name ?? 'Error'
    if (telemetry.error?.stack) error.stack = telemetry.error.stack
    trackRuntimeExceptionOnce(error, {
      'error.operation': telemetry.name,
    })
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  }
  span.end(telemetry.endTime)
}

export async function runWithServiceTrace<T>(
  carrier: ServiceCallTraceContext | undefined,
  serviceName: string,
  serviceMethod: string,
  operation: (span?: Span) => Promise<T>,
): Promise<T> {
  if (!enabled) return operation()

  const parentContext = carrier ? propagation.extract(ROOT_CONTEXT, carrier) : context.active()
  return tracer.startActiveSpan(
    `${serviceName}.${serviceMethod}`,
    {
      kind: SpanKind.SERVER,
      attributes: createAttributes({
        'rpc.system': 'electron.ipc',
        'rpc.service': serviceName,
        'rpc.method': serviceMethod,
      }),
    },
    parentContext,
    async (span) => {
      try {
        return await operation(span)
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        trackRuntimeExceptionOnce(error, {
          'error.operation': 'service-transport',
          'rpc.service': serviceName,
          'rpc.method': serviceMethod,
        })
        throw error
      } finally {
        span.end()
      }
    },
  )
}

export async function runWithInternalSpan<T>(
  name: string,
  operation: () => Promise<T>,
  attributes?: TelemetryProperties,
): Promise<T> {
  if (!enabled) return operation()

  return tracer.startActiveSpan(
    name,
    {
      kind: SpanKind.INTERNAL,
      attributes: createAttributes(attributes),
    },
    async (span) => {
      try {
        return await operation()
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    },
  )
}

function isServiceCallFailure(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value
}

export async function runWithRendererServiceTrace<T>(
  carrier: ServiceCallTraceContext,
  serviceName: string,
  serviceMethod: string,
  operation: (span?: Span) => Promise<T>,
): Promise<T> {
  if (!enabled) return operation()

  let rendererContext = carrier.actionId
    ? propagation.extract(ROOT_CONTEXT, carrier)
    : ROOT_CONTEXT
  if (carrier.actionId) {
    rendererContext = rendererContext.setValue(rendererActionIdKey, carrier.actionId)
  }
  return tracer.startActiveSpan(
    `${serviceName}.${serviceMethod}`,
    {
      kind: SpanKind.CLIENT,
      attributes: createAttributes({
        'rpc.system': 'electron.ipc',
        'rpc.service': serviceName,
        'rpc.method': serviceMethod,
        'server.address': 'xmcl-runtime',
        'xmcl.client.type': 'Browser',
        'xmcl.telemetry.origin': 'renderer',
      }),
    },
    rendererContext,
    async (span) => {
      try {
        const result = await runWithServiceTrace(undefined, serviceName, serviceMethod, operation)
        if (isServiceCallFailure(result)) {
          span.setStatus({ code: SpanStatusCode.ERROR })
        }
        return result
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        span.end()
      }
    },
  )
}

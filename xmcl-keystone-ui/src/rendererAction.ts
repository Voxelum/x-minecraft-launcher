import type {
  RendererActionContext,
  RendererActionEnd,
  RendererTelemetryAttribute,
  ServiceCallTraceContext,
} from '@xmcl/runtime-api'

let enabled = true
let serviceTraceParent: ServiceCallTraceContext | undefined

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function serializeRendererError(error: unknown): NonNullable<RendererActionEnd['error']> {
  const value = error && typeof error === 'object' ? (error as Record<string, any>) : undefined
  return {
    name: typeof value?.name === 'string' ? value.name : 'Error',
    message:
      typeof value?.message === 'string'
        ? value.message
        : typeof error === 'string'
          ? error
          : String(error),
    stack: typeof value?.stack === 'string' ? value.stack : undefined,
    origin: value?.origin === 'runtime-service' ? 'runtime-service' : 'renderer',
  }
}

export interface RendererServiceTrace {
  context: ServiceCallTraceContext
}

export interface RendererActionScope {
  readonly context: RendererActionContext | undefined
  run<T>(operation: () => T): T
  fail(error: unknown): void
}

export function isRuntimeServiceError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'origin' in error &&
    error.origin === 'runtime-service'
  )
}

export function startRendererServiceTrace(): RendererServiceTrace {
  if (serviceTraceParent) {
    return { context: serviceTraceParent }
  }
  const traceId = randomHex(16)
  const spanId = randomHex(8)
  return {
    context: {
      traceparent: `00-${traceId}-${spanId}-01`,
    },
  }
}

export async function withRendererAction<T>(
  name: string,
  operation: (action: RendererActionScope) => Promise<T>,
  attributes?: Record<string, RendererTelemetryAttribute>,
): Promise<T> {
  let actionContext: RendererActionContext | undefined
  try {
    actionContext = enabled ? await rendererTelemetry.startAction({ name, attributes }) : undefined
  } catch (error) {
    console.warn(`Failed to start renderer action ${name}`, error)
  }

  let hasReportedError = false
  let reportedError: unknown
  const action: RendererActionScope = {
    context: actionContext,
    run(operation) {
      if (!actionContext) return operation()
      const previous = serviceTraceParent
      serviceTraceParent = {
        traceparent: actionContext.traceparent,
        actionId: actionContext.id,
      }
      try {
        return operation()
      } finally {
        serviceTraceParent = previous
      }
    },
    fail(error) {
      hasReportedError = true
      reportedError = error
    },
  }

  try {
    const result = await operation(action)
    if (actionContext) {
      try {
        await rendererTelemetry.endAction(
          hasReportedError
            ? {
                id: actionContext.id,
                outcome: 'error',
                error: serializeRendererError(reportedError),
              }
            : { id: actionContext.id, outcome: 'success' },
        )
      } catch (endError) {
        console.warn(`Failed to end renderer action ${name}`, endError)
      }
    }
    return result
  } catch (error) {
    if (actionContext) {
      try {
        await rendererTelemetry.endAction({
          id: actionContext.id,
          outcome: 'error',
          error: serializeRendererError(error),
        })
      } catch (endError) {
        console.warn(`Failed to end renderer action ${name}`, endError)
      }
    }
    throw error
  }
}

export function runInRendererAction<T>(
  action: RendererActionScope | undefined,
  operation: () => T,
) {
  return action ? action.run(operation) : operation()
}

export function hasRendererActionContext() {
  return serviceTraceParent !== undefined
}

export function runRendererAction<T>(
  action: RendererActionScope | undefined,
  name: string,
  operation: (scope: RendererActionScope) => Promise<T>,
  attributes?: Record<string, RendererTelemetryAttribute>,
) {
  return action ? operation(action) : withRendererAction(name, operation, attributes)
}

export function setRendererActionEnabled(value: boolean) {
  enabled = value
}

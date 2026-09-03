import { i18n } from './i18n'
import { isRuntimeServiceError, setRendererActionEnabled } from './rendererAction'

export { isRuntimeServiceError } from './rendererAction'

let enabled = true

const vuetifyDetachedOverlayMessage =
  "Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of type 'Element'."

function getRendererException(exception: unknown) {
  const value =
    exception && typeof exception === 'object' ? (exception as Record<string, any>) : undefined
  const message =
    typeof value?.message === 'string'
      ? value.message
      : typeof exception === 'string'
        ? exception
        : String(exception)
  return {
    name: typeof value?.name === 'string' ? value.name : 'Error',
    message,
    stack: typeof value?.stack === 'string' ? value.stack : undefined,
    source: value,
  }
}

function getExceptionProperties(
  message: string,
  source: Record<string, any> | undefined,
): Record<string, string> | undefined {
  if (!/^SyntaxError:\s*(?:\{\s*"code"\s*:\s*)?24\b/.test(message)) {
    return undefined
  }

  const properties: Record<string, string> = {}
  try {
    properties.locale = String((i18n.global.locale as any).value)
  } catch {}
  properties.route = typeof window !== 'undefined' ? window.location.hash : ''

  const snippet = source?.location?.source ?? source?.source ?? source?.codeFrame
  if (typeof snippet === 'string') {
    properties.snippet = snippet.slice(0, 80)
  }
  if (typeof source?.code === 'number' || typeof source?.code === 'string') {
    properties.compileCode = String(source.code)
  }
  return properties
}

function isIgnoredRendererException(message: string) {
  return (
    message.includes('ResizeObserver loop') ||
    message.includes('onMounted is called when there') ||
    message.includes('Failed to fetch') ||
    message === 'The operation was aborted' ||
    message === 'This operation was aborted' ||
    message.startsWith('AbortError') ||
    message === 'Key is required' ||
    isIgnorableRendererExceptionMessage(message)
  )
}

export function setRendererTelemetryEnabled(value: boolean) {
  enabled = value
  setRendererActionEnabled(value)
}

export async function trackRendererException(exception: unknown) {
  if (!enabled) return
  if (isRuntimeServiceError(exception)) return

  const { name, message, stack, source } = getRendererException(exception)
  if (isIgnoredRendererException(message)) return

  try {
    await rendererTelemetry.trackException({
      name,
      message,
      stack,
      properties: getExceptionProperties(message, source),
    })
  } catch (error) {
    console.warn('Failed to send renderer exception telemetry', error)
  }
}

export async function flushRendererTelemetry() {
  if (!enabled) return
  try {
    await rendererTelemetry.flush()
  } catch (error) {
    console.warn('Failed to flush renderer telemetry', error)
  }
}

export function isIgnorableRendererExceptionMessage(message: string) {
  return message.includes(vuetifyDetachedOverlayMessage)
}

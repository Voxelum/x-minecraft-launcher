const MAX_AGENT_LOG_LENGTH = 200_000
const SENSITIVE_KEY = /^(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret)$/i

function redactString(value: string): string {
  return value.replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
}

function sanitizeEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    url.username = ''
    url.password = ''
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, '[redacted]')
    }
    return url.toString()
  } catch {
    return redactString(endpoint)
  }
}

export function stringifyAgentLog(value: unknown): string {
  let serialized: string
  try {
    serialized = JSON.stringify(value, (key, entry) => {
      if (SENSITIVE_KEY.test(key)) return '[redacted]'
      if (typeof entry === 'string') return redactString(entry)
      if (entry instanceof Error) {
        return {
          name: entry.name,
          message: entry.message,
          stack: entry.stack,
        }
      }
      return entry
    })
  } catch {
    serialized = String(value)
  }
  if (serialized.length <= MAX_AGENT_LOG_LENGTH) return serialized
  return `${serialized.slice(0, MAX_AGENT_LOG_LENGTH)}...[truncated ${serialized.length - MAX_AGENT_LOG_LENGTH} chars]`
}

export function agentDebug(event: string, payload?: unknown) {
  if (!import.meta.env.DEV) return
  const suffix = payload === undefined ? '' : ` ${stringifyAgentLog(payload)}`
  console.info(`[agent][${event}]${suffix}`)
}

export function agentDebugEndpoint(endpoint: string): string {
  return sanitizeEndpoint(endpoint)
}

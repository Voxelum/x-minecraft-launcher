const MAX_AGENT_LOG_LENGTH = 200_000
const SENSITIVE_KEY = /^(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|secret)$/i

function redactString(value: string): string {
  return value.replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
}

export function sanitizeAgentLog(value: unknown): string {
  let serialized: string
  try {
    serialized = JSON.stringify(value, (key, entry) => {
      if (SENSITIVE_KEY.test(key)) return '[redacted]'
      if (typeof entry === 'string') return redactString(entry)
      if (entry instanceof Error) return { name: entry.name, message: entry.message, stack: entry.stack }
      return entry
    })
  } catch {
    serialized = String(value)
  }
  return serialized.length <= MAX_AGENT_LOG_LENGTH
    ? serialized
    : `${serialized.slice(0, MAX_AGENT_LOG_LENGTH)}...[truncated ${serialized.length - MAX_AGENT_LOG_LENGTH} chars]`
}

export function sanitizeAgentEndpoint(endpoint: string) {
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

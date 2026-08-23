export type MultiplayerLogLevel = 'info' | 'warn' | 'error'

export interface MultiplayerLogEvent {
  level: MultiplayerLogLevel
  event: string
  data?: Record<string, unknown>
}

export interface MultiplayerLogger {
  emit(event: MultiplayerLogEvent): void
}

export const noopMultiplayerLogger: MultiplayerLogger = { emit() {} }

export function serializeMultiplayerLogEvent(event: MultiplayerLogEvent) {
  return `${event.event}${event.data ? ` ${JSON.stringify(event.data)}` : ''}`
}

export function summarizeCandidates(candidates: Array<{ candidate: string }>) {
  const summary = {
    total: candidates.length,
    host: 0,
    srflx: 0,
    prflx: 0,
    relay: 0,
    udp: 0,
    tcp: 0,
  }
  for (const { candidate } of candidates) {
    const normalized = candidate.toLowerCase()
    if (normalized.includes(' typ host')) summary.host++
    if (normalized.includes(' typ srflx')) summary.srflx++
    if (normalized.includes(' typ prflx')) summary.prflx++
    if (normalized.includes(' typ relay')) summary.relay++
    if (normalized.includes(' udp ')) summary.udp++
    if (normalized.includes(' tcp ')) summary.tcp++
  }
  return summary
}

function sanitizeIceUrl(url: string) {
  return url.replace(/^(stuns?|turns?):(?:[^@/?]+(?::[^@/?]*)?@)?/i, '$1:')
}

export function summarizeIceServer(server: RTCIceServer | undefined) {
  if (!server) return undefined
  const urls = typeof server.urls === 'string' ? [server.urls] : server.urls
  return {
    urls: urls.map(sanitizeIceUrl),
    authenticated: Boolean(server.username && server.credential),
  }
}

export function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 1_024),
    }
  }
  return { name: 'UnknownError', message: String(error).slice(0, 1_024) }
}

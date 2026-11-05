import { isUpstreamLauncherUrl } from '../xmcl-runtime/network/upstreamNetworkPolicy'

const urlPattern = /(?:https?|wss?):\/\/[^\s"'<>`\\]+/gi

/** Only sendHeaders records establish that a Node request reached dispatch. */
export function auditUndiciLog(source: string): string[] {
  const requests = [...source.matchAll(/client:sendHeaders\s+\S+\s+(\S+)/g)]
  return [...new Set(requests.flatMap(match => urlsIn(match[1]))
    .filter(url => isUpstreamLauncherUrl(url) || isTelemetryUrl(url))
    .map(url => url.origin))].sort()
}

function isTelemetryUrl(url: URL) {
  const host = url.hostname.toLowerCase()
  return host.endsWith('.applicationinsights.azure.com') ||
    host === 'dc.services.visualstudio.com' || host.endsWith('.monitor.azure.com')
}

function urlsIn(text: string): URL[] {
  return [...text.replaceAll('\\/', '/').matchAll(urlPattern)].flatMap(match => {
    try { return [new URL(match[0])] } catch { return [] }
  })
}

/** Static tripwire for the removed updater, flags/news fetches and Azure exporters.
 * Attribution and service origins still used by disabled modules are permitted;
 * the runtime guard and captured-traffic audit cover those destinations.
 */
export function auditBundle(source: string): string[] {
  return [...new Set(urlsIn(source).filter(url => isTelemetryUrl(url) ||
    (isUpstreamLauncherUrl(url) && (
      /^\/(?:api\/)?(?:latest|flights|news)(?:\/|$)/i.test(url.pathname) ||
      /\/releases\/download\//i.test(url.pathname) ||
      url.hostname === 'xmcl.blob.core.windows.net' ||
      url.hostname === 'registry.npmmirror.com'
    )),
  ).map(url => url.origin + url.pathname))]
}

/** Inspect only recorded events, not explanatory strings in NetLog's schema. */
export function auditNetworkLog(log: unknown): string[] {
  if (!log || typeof log !== 'object' || !('events' in log) ||
    !Array.isArray(log.events) || log.events.length === 0) {
    throw new Error('Expected a nonempty Chromium NetLog events array')
  }
  const violations = new Set<string>()
  // Chromium replays persisted HTTP/2 and HTTP/3 server preferences at boot.
  // Those describe historical connections, not traffic from this capture.
  const eventTypes = (log as { constants?: { logEventTypes?: Record<string, number> } }).constants?.logEventTypes
  const historicalTypes = new Set([
    eventTypes?.HTTP_SERVER_PROPERTIES_UPDATE_CACHE,
    eventTypes?.HTTP_SERVER_PROPERTIES_UPDATE_PREFS,
  ].filter(type => type !== undefined))
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      const urls = urlsIn(value)
      // DNS events can record a bare hostname and port rather than a URL.
      if (!urls.length && /^[\w.-]+\.[a-z]+\.?(:\d+)?$/i.test(value)) {
        try { urls.push(new URL('https://' + value)) } catch { /* Not a hostname. */ }
      }
      for (const url of urls) {
        if (isUpstreamLauncherUrl(url) || isTelemetryUrl(url)) violations.add(url.origin)
      }
    } else if (value && typeof value === 'object') {
      for (const child of Object.values(value)) visit(child)
    }
  }
  for (const event of log.events) {
    if (!historicalTypes.has(event.type)) visit(event.params)
  }
  return [...violations].sort()
}

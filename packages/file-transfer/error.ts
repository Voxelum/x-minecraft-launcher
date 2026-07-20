
function safeSet(err: Error, key: string, value: unknown): void {
  try {
    (err as any)[key] = value
  } catch {
    try {
      Object.defineProperty(err, key, { value, configurable: true, writable: true, enumerable: false })
    } catch {
      // The target property is non-writable, non-configurable and the
      // object is frozen. Accept it — better to surface the original
      // error than to crash the error pipeline with a `TypeError:
      // Cannot set property name of <obj> which has only a getter`
      // (problemId "TypeError at decorateError" in telemetry).
    }
  }
}

function sanitizeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return undefined
  }
}

export function getDestinationExtension(path: string) {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

/**
 * Adds safe request context before an HTTP error is rejected. Unlike
 * `decorateError`, this runs at the handler boundary, before a rejected
 * promise can be observed by global exception telemetry.
 */
export function decorateHttpError(
  err: Error,
  requestUrl?: string,
  redirects?: URL[],
  destinationExtension?: string,
) {
  const sanitizedRedirects = redirects
    ?.map((url) => sanitizeUrl(url.toString()))
    .filter((url): url is string => !!url)
  const responseUrl = sanitizedRedirects?.at(-1) ?? (requestUrl ? sanitizeUrl(requestUrl) : undefined)
  if (responseUrl) {
    safeSet(err, 'downloadUrl', responseUrl)
    safeSet(err, 'downloadHost', new URL(responseUrl).host)
  }
  if (sanitizedRedirects?.length) {
    safeSet(err, 'downloadRedirects', JSON.stringify(sanitizedRedirects))
  }
  if (destinationExtension) {
    safeSet(err, 'downloadDestinationExtension', destinationExtension)
  }
}

export function decorateError(
  err: Error,
  urls: string[],
  headers: Record<string, any>,
  destination: string,
) {
  safeSet(err, 'name', 'DownloadError')
  safeSet(err, 'urls', urls.join(' '))
  safeSet(err, 'headers', headers)
  safeSet(err, 'destination', destination)

  // These fields are safe to forward to telemetry: query strings and local
  // paths can contain credentials or personal data, so retain only origin,
  // pathname, and file extension.
  const sanitizedUrls = urls.map(sanitizeUrl).filter((url): url is string => !!url)
  safeSet(err, 'downloadUrls', JSON.stringify(sanitizedUrls))
  safeSet(err, 'downloadHosts', JSON.stringify([...new Set(sanitizedUrls.map((url) => new URL(url).host))]))
  safeSet(err, 'downloadDestinationExtension', getDestinationExtension(destination))
}

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
}
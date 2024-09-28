export const isValidUrl = (url: string) => {
  try {
    // eslint-disable-next-line no-new
    return new URL(url)
  } catch (e) {
    return undefined
  }
}
/**
 * Join two urls
 */
export function joinUrl(a: string, b: string) {
  if (a.endsWith('/') && b.startsWith('/')) {
    return a + b.substring(1)
  }
  if (!a.endsWith('/') && !b.startsWith('/')) {
    return a + '/' + b
  }
  return a + b
}

export function replaceHost(a: string | URL, b: string | URL) {
  if (a instanceof URL) {
    a = a.toString()
  }
  const url = new URL(a)

  let host
  if (b instanceof URL) {
    host = b.toString()
  } else {
    host = new URL(b).host
  }

  url.host = host

  return url.toString()
}

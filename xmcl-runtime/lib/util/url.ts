import { URL } from 'url'

export const isValidateUrl = (url: string) => {
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

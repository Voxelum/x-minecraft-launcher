import { IncomingHttpHeaders } from 'http'

/**
 * Normalize header from string array to dictionary
 */
export function buildHeaders(headers: string[] | Record<string, string | string[]> | IncomingHttpHeaders): Record<string, string | string[]> | IncomingHttpHeaders {
  // When using undici.fetch, the headers list is stored
  // as an array.
  if (Array.isArray(headers)) {
    const headersPair: Record<string, string> = {}

    for (let i = 0; i < headers.length; i += 2) {
      headersPair[headers[i].toLowerCase()] = headers[i + 1]
    }

    return headersPair
  }

  return headers
}

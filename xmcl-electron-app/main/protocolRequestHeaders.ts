/**
 * Forward the browser-provided web referrer when bridging an Electron protocol
 * request, where it may be separate from the headers. Preserve existing
 * Referer headers and omit absent or non-web referrers; embedded players such
 * as YouTube need this client identification to avoid error 153.
 */
export function forwardReferrerHeader(headers: Record<string, string>, referrer: string) {
  if (headers.referer || !referrer || referrer === 'about:client' || !URL.canParse(referrer)) return

  const url = new URL(referrer)
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    headers.referer = url.href
  }
}

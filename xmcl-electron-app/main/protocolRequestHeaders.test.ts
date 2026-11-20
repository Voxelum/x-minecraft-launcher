import { describe, expect, it } from 'vitest'
import { forwardReferrerHeader } from './protocolRequestHeaders'

describe('forwardReferrerHeader', () => {
  it('forwards the browser-provided referrer when absent from headers', () => {
    const headers: Record<string, string> = {}
    forwardReferrerHeader(headers, 'http://xmcl.runtime/')
    expect(headers.referer).toBe('http://xmcl.runtime/')
  })

  it('preserves an existing referrer and ignores absent or non-web referrers', () => {
    const headers: Record<string, string> = { referer: 'https://example.com/' }
    forwardReferrerHeader(headers, 'https://other.example/')
    expect(headers.referer).toBe('https://example.com/')

    const emptyHeaders: Record<string, string> = {}
    forwardReferrerHeader(emptyHeaders, 'about:client')
    forwardReferrerHeader(emptyHeaders, 'file:///tmp/page.html')
    expect(emptyHeaders).toEqual({})
  })
})

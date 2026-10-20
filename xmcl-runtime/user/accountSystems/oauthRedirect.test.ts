import { describe, expect, it } from 'vitest'
import { isOAuthLoopbackRedirect, parseOAuthRedirect } from './oauthRedirect'

describe('oauthRedirect', () => {
  const redirect = new URL('http://localhost:25555/auth')

  it('matches an exact origin', () => {
    expect(isOAuthLoopbackRedirect(new URL('http://localhost:25555/auth?code=1'), redirect)).toBe(true)
  })

  it('treats 127.0.0.1 as localhost on the same port and path', () => {
    expect(parseOAuthRedirect('http://127.0.0.1:25555/auth?code=abc', redirect)?.searchParams.get('code')).toBe('abc')
  })

  it('treats IPv6 loopback as localhost', () => {
    expect(parseOAuthRedirect('http://[::1]:25555/auth?code=abc', redirect)?.searchParams.get('code')).toBe('abc')
  })

  it('rejects a different path or port', () => {
    expect(parseOAuthRedirect('http://127.0.0.1:25555/other?code=abc', redirect)).toBeUndefined()
    expect(parseOAuthRedirect('http://127.0.0.1:80/auth?code=abc', redirect)).toBeUndefined()
  })

  it('ignores malformed URLs', () => {
    expect(parseOAuthRedirect('not a url', redirect)).toBeUndefined()
  })
})

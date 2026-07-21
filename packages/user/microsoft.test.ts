import { MockAgent, fetch as _fetch } from 'undici'
import { describe, expect, it } from 'vitest'
import { MicrosoftAuthenticator, MicrosoftMinecraftXboxLoginError } from './microsoft'

describe('MicrosoftAuthenticator', () => {
  const agent = new MockAgent()
  const fetch: typeof globalThis.fetch = (input, init) => {
    init = Object.assign(init || {}, {
      dispatcher: agent,
    })
    return _fetch(input as any, init as any) as any
  }

  describe('#authenticateXboxLive', () => {
    it('should be able to authenticate ', async () => {
      const pool = agent.get('https://user.auth.xboxlive.com')
      pool
        .intercept({
          method: 'POST',
          path: '/user/authenticate',
          body: JSON.stringify({
            Properties: {
              AuthMethod: 'RPS',
              SiteName: 'user.auth.xboxlive.com',
              RpsTicket: 'd=ci010',
            },
            RelyingParty: 'http://auth.xboxlive.com',
            TokenType: 'JWT',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .reply(200, { hello: 'good' })
      const client = new MicrosoftAuthenticator({ fetch })
      await expect(client.authenticateXboxLive('ci010')).resolves.toEqual({ hello: 'good' })
    })
  })

  it('should return XSTS token', async () => {
    // Arrange
    const xblResponseToken = 'some-token'
    const relyingParty = 'rp://api.minecraftservices.com/'
    const expectedToken = 'some-xsts-token'

    agent
      .get('https://xsts.auth.xboxlive.com')
      .intercept({
        method: 'POST',
        path: '/xsts/authorize',
        body: JSON.stringify({
          Properties: {
            SandboxId: 'RETAIL',
            UserTokens: [xblResponseToken],
          },
          RelyingParty: relyingParty,
          TokenType: 'JWT',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .reply(200, { Token: expectedToken })

    // Act
    const client = new MicrosoftAuthenticator({ fetch })
    const result = await client.authorizeXboxLive(xblResponseToken, relyingParty)

    // Assert
    expect(result.Token).to.equal(expectedToken)
  })

  describe('#acquireXBoxToken', () => {
    const xblToken = 'xbl-token'
    const interceptXbl = () => {
      agent
        .get('https://user.auth.xboxlive.com')
        .intercept({ method: 'POST', path: '/user/authenticate' })
        .reply(200, { Token: xblToken })
    }
    const interceptAuthorize = (relyingParty: string, status: number, body: any) => {
      agent
        .get('https://xsts.auth.xboxlive.com')
        .intercept({
          method: 'POST',
          path: '/xsts/authorize',
          body: JSON.stringify({
            Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
            RelyingParty: relyingParty,
            TokenType: 'JWT',
          }),
        })
        .reply(status, body)
    }

    it('does not fail when the xboxlive.com (avatar) authorization fails', async () => {
      interceptXbl()
      interceptAuthorize('rp://api.minecraftservices.com/', 200, { Token: 'mc-xsts' })
      // The live/avatar relying party fails (e.g. no full Xbox profile).
      interceptAuthorize('http://xboxlive.com', 401, { XErr: 2148916233 })

      const client = new MicrosoftAuthenticator({ fetch })
      const result = await client.acquireXBoxToken('oauth-token')

      expect(result.minecraftXstsResponse.Token).to.equal('mc-xsts')
      expect(result.liveXstsResponse).toBeUndefined()
    })

    it('returns both tokens when everything succeeds', async () => {
      interceptXbl()
      interceptAuthorize('rp://api.minecraftservices.com/', 200, { Token: 'mc-xsts' })
      interceptAuthorize('http://xboxlive.com', 200, { Token: 'live-xsts' })

      const client = new MicrosoftAuthenticator({ fetch })
      const result = await client.acquireXBoxToken('oauth-token')

      expect(result.minecraftXstsResponse.Token).to.equal('mc-xsts')
      expect(result.liveXstsResponse?.Token).to.equal('live-xsts')
    })
  })

  describe('#loginMinecraftWithXBox', () => {
    it('throws MicrosoftMinecraftXboxLoginError with status + body for a non-200 response', async () => {
      const pool = agent.get('https://api.minecraftservices.com')
      pool
        .intercept({
          method: 'POST',
          path: '/authentication/login_with_xbox',
        })
        .reply(401, 'unauthorized body')

      const client = new MicrosoftAuthenticator({ fetch })
      await expect(client.loginMinecraftWithXBox('uhs', 'xsts')).rejects.toMatchObject({
        name: 'MicrosoftMinecraftXboxLoginError',
        status: 401,
        body: 'unauthorized body',
        retryable: false,
      })
    })

    it('parses Retry-After (seconds) into retryAfter ms and marks 429 retryable', async () => {
      const pool = agent.get('https://api.minecraftservices.com')
      pool
        .intercept({
          method: 'POST',
          path: '/authentication/login_with_xbox',
        })
        .reply(429, '', { headers: { 'retry-after': '2' } })

      const client = new MicrosoftAuthenticator({ fetch })
      try {
        await client.loginMinecraftWithXBox('uhs', 'xsts')
        throw new Error('expected throw')
      } catch (e: any) {
        expect(e).toBeInstanceOf(MicrosoftMinecraftXboxLoginError)
        expect(e.status).toBe(429)
        expect(e.retryable).toBe(true)
        expect(e.retryAfter).toBe(2000)
      }
    })
  })
})

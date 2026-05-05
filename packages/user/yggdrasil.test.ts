import { describe, expect, it } from 'vitest'
import { MockAgent, fetch as _fetch } from 'undici'
import { YggdrasilClient, YggdrasilError } from './yggdrasil'

describe('YggdrasilClient', () => {
  const agent = new MockAgent()
  const API = {
    hostName: 'http://random.authserver',
    authenticate: '/authenticate',
    refresh: '/refresh',
    validate: '/validate',
    invalidate: '/invalidate',
    signout: '/signout',
  }
  const clientToken = 'clientToken'
  const fetch: typeof globalThis.fetch = (input, init) => {
    init = Object.assign(init || {}, {
      dispatcher: agent,
    })
    return _fetch(input as any, init as any) as any
  }

  describe('#validate', () => {
    it('should be able to valid accessToken with response 200', async () => {
      agent
        .get(API.hostName)
        .intercept({
          method: 'POST',
          path: API.validate,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(200)
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(client.validate('accessToken', clientToken)).resolves.toBeTruthy()
    })
    it('should return false when validate an invalid access token with response 400', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.validate,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
          }),
        })
        .reply(400)
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(client.validate('accessToken', clientToken)).resolves.toBeFalsy()
    })
  })

  describe('#invalidate', () => {
    it('should be able to invalid accessToken with response 200', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.invalidate,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
          }),
        })
        .reply(200)
      const client = new YggdrasilClient(API.hostName, { fetch })

      expect(await client.invalidate('accessToken', clientToken)).toBeTruthy()
    })
    it('should return false when invalidate an invalid access token with response 400', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.invalidate,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
          }),
        })
        .reply(400)
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(client.invalidate('accessToken', clientToken)).resolves.toBeFalsy()
    })
  })

  describe('#login', () => {
    it('should be able to login with response 200', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.authenticate,
          body: JSON.stringify({
            agent: { name: 'Minecraft', version: 1 },
            requestUser: false,
            username: 'username',
            password: 'password',
            clientToken,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(200, '{}')
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(
        client.login({
          username: 'username',
          password: 'password',
          clientToken,
        }),
      ).resolves.toBeTruthy()
    })
    it('should be able to login without request user with response 200', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.authenticate,
          body: JSON.stringify({
            agent: { name: 'Minecraft', version: 1 },
            requestUser: false,
            username: 'username',
            password: 'password',
            clientToken,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(200, '{}')
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(
        client.login({
          username: 'username',
          password: 'password',
          clientToken,
          requestUser: false,
        }),
      ).resolves.toBeTruthy()
    })
    it('should reject when login with response 400', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.authenticate,
          body: JSON.stringify({
            agent: { name: 'Minecraft', version: 1 },
            requestUser: false,
            username: 'username',
            password: 'password',
            clientToken,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(
          400,
          JSON.stringify({
            error: 'InvalidArguments',
          }),
        )
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(
        client.login({
          username: 'username',
          password: 'password',
          clientToken,
        }),
      ).rejects.toBeInstanceOf(YggdrasilError)
    })
  })

  describe('#refresh', () => {
    it('should be able to refresh with response 200', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.refresh,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
            requestUser: false,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(200, '{}')
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(
        client.refresh({
          accessToken: 'accessToken',
          clientToken,
        }),
      ).resolves.toBeTruthy()
    })
    it('should throw error when refresh with response 400', async () => {
      const pool = agent.get(API.hostName)
      pool
        .intercept({
          method: 'POST',
          path: API.refresh,
          body: JSON.stringify({
            accessToken: 'accessToken',
            clientToken,
            requestUser: false,
          }),
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
        })
        .reply(
          400,
          JSON.stringify({
            error: 'InvalidArguments',
          }),
        )
      const client = new YggdrasilClient(API.hostName, { fetch })
      await expect(
        client.refresh({
          accessToken: 'accessToken',
          clientToken,
        }),
      ).rejects.toBeInstanceOf(YggdrasilError)
    })
  })
})

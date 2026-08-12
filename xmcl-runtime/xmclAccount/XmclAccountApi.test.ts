import { describe, expect, it, vi } from 'vitest'
import { createPublicKey, verify } from 'crypto'
import { XmclAccountApi, XmclAccountApiError } from './XmclAccountApi'
import { generateXmclDpopKey } from './XmclAccountDpop'
import { M1_LOCAL_AUTH_FIXTURE, M1_SHARED_V1_POLICY_FIXTURE } from './fixtures'

describe('XmclAccountApi', () => {
  it('uses the injected XMCL API origin', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      Response.json(M1_LOCAL_AUTH_FIXTURE),
    )
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/')

    await api.launcherExchange('modrinth', 'provider-secret')

    expect(String(fetch.mock.calls[0]![0])).toBe(
      'https://edge.example.test/v1/auth/modrinth/launcher-exchange',
    )
  })

  it('keeps provider and XMCL credentials in main-process requests', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      Response.json(M1_LOCAL_AUTH_FIXTURE),
    )
    const api = new XmclAccountApi(fetch)

    const result = await api.launcherExchange('modrinth', 'provider-secret')

    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({
      loginTransactionId: expect.any(String),
      completedAt: expect.any(String),
      credential: 'provider-secret',
      dpopJwk: {
        kty: 'EC',
        crv: 'P-256',
        x: expect.any(String),
        y: expect.any(String),
      },
    })
    expect(result.session.accessToken).toBe('fixture-access-token')
  })

  it('binds browser and launcher exchanges to the same P-256 public JWK', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          transactionId: 'transaction-1',
          authorizationUrl: 'https://provider.example/authorize',
          expiresAt: '2026-07-22T01:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(Response.json(M1_LOCAL_AUTH_FIXTURE))
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/')

    await api.beginBrowserAuthorization('google', {
      state: 'state-1',
      redirectUri: 'http://127.0.0.1:25555/commercial-auth',
      codeChallenge: 'challenge-1',
    })
    await api.exchangeBrowser({
      provider: 'google',
      transactionId: 'transaction-1',
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://127.0.0.1:25555/commercial-auth',
    })

    const firstUrl = new URL(String(fetch.mock.calls[0]![0]))
    const firstJwk = JSON.parse(firstUrl.searchParams.get('dpopJwk')!)
    const secondBody = JSON.parse(String(fetch.mock.calls[1]![1]?.body))
    expect(secondBody.dpopJwk).toEqual(firstJwk)
    expect(firstJwk).toMatchObject({
      kty: 'EC',
      crv: 'P-256',
      x: expect.any(String),
      y: expect.any(String),
    })
  })

  it('retries the DPoP key provider after a transient failure', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        transactionId: 'transaction-1',
        authorizationUrl: 'https://provider.example/authorize',
        expiresAt: '2026-07-22T01:00:00.000Z',
      }),
    )
    const key = generateXmclDpopKey()
    const keyProvider = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary secure storage failure'))
      .mockResolvedValue(key)
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/', keyProvider)
    const request = {
      state: 'state-1',
      redirectUri: 'http://127.0.0.1:25555/commercial-auth',
      codeChallenge: 'challenge-1',
    }

    await expect(api.beginBrowserAuthorization('discord', request)).rejects.toThrow(
      'Temporary secure storage failure',
    )
    await expect(api.beginBrowserAuthorization('discord', request)).resolves.toMatchObject({
      transactionId: 'transaction-1',
    })

    expect(keyProvider).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('creates a signed DPoP proof for resource requests', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      Response.json(M1_SHARED_V1_POLICY_FIXTURE),
    )
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/')
    const credential = { ...M1_LOCAL_AUTH_FIXTURE.session, tokenType: 'DPoP' as const }

    await api.getBackupStoragePolicy(credential)

    const [input, init] = fetch.mock.calls[0]!
    const proof = (init?.headers as Headers).get('DPoP')!
    const [encodedHeader, encodedPayload, encodedSignature] = proof.split('.')
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString())
    expect(header).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256', jwk: header.jwk })
    expect(payload).toMatchObject({
      jti: expect.stringMatching(/^[0-9a-f-]{36}$/),
      htm: 'GET',
      htu: 'https://edge.example.test/v1/backup-storage-policy',
      iat: expect.any(Number),
      ath: expect.any(String),
    })
    expect((init?.headers as Headers).get('Authorization')).toBe(`DPoP ${credential.accessToken}`)
    expect(
      verify(
        'sha256',
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        { key: createPublicKey({ key: header.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
        Buffer.from(encodedSignature, 'base64url'),
      ),
    ).toBe(true)
    expect(Buffer.from(encodedSignature, 'base64url')).toHaveLength(64)
    expect(String(input)).toBe('https://edge.example.test/v1/backup-storage-policy')
  })

  it('parses the wrapped refresh response and omits the access-token hash from its proof', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      Response.json({ session: M1_LOCAL_AUTH_FIXTURE.session }),
    )
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/')

    const session = await api.refreshSession({
      ...M1_LOCAL_AUTH_FIXTURE.session,
      tokenType: 'DPoP',
    })

    const headers = fetch.mock.calls[0]![1]?.headers as Headers
    const payload = JSON.parse(
      Buffer.from(headers.get('DPoP')!.split('.')[1]!, 'base64url').toString(),
    )
    expect(session).toEqual(M1_LOCAL_AUTH_FIXTURE.session)
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({
      sessionId: M1_LOCAL_AUTH_FIXTURE.session.sessionId,
      refreshToken: M1_LOCAL_AUTH_FIXTURE.session.refreshToken,
    })
    expect(payload).not.toHaveProperty('ath')
  })

  it('creates a one-time browser authorization before opening the provider', async () => {
    const calls: Array<[string | URL, RequestInit | undefined]> = []
    const fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      calls.push([input, init])
      return Response.json({
        transactionId: 'transaction-1',
        authorizationUrl: 'https://provider.example/authorize',
        expiresAt: '2026-07-22T01:00:00.000Z',
      })
    })
    const api = new XmclAccountApi(fetch)

    const authorization = await api.beginBrowserAuthorization('google', {
      state: 'state-1',
      redirectUri: 'http://127.0.0.1:25555/commercial-auth',
      codeChallenge: 'challenge-1',
    })

    expect(authorization.transactionId).toBe('transaction-1')
    const [input, init] = calls[0]!
    const url = new URL(String(input))
    expect(url.pathname).toBe('/v1/auth/google/authorize')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.get('redirectUri')).toBe('http://127.0.0.1:25555/commercial-auth')
    expect(url.searchParams.get('codeChallenge')).toBe('challenge-1')
    expect(url.searchParams.get('dpopJwk')).toMatch(/"kty":"EC"/)
    expect(init?.method).toBe('GET')
  })

  it('strips subjects and session credentials from renderer snapshots', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(M1_LOCAL_AUTH_FIXTURE.account))
      .mockResolvedValueOnce(
        Response.json([
          {
            ...M1_LOCAL_AUTH_FIXTURE.identities![0],
            subject: 'provider-subject',
          },
        ]),
      )
      .mockResolvedValueOnce(Response.json(M1_SHARED_V1_POLICY_FIXTURE))
    const api = new XmclAccountApi(fetch)

    const snapshot = await api.getSnapshot(M1_LOCAL_AUTH_FIXTURE.session)

    expect(JSON.stringify(snapshot)).not.toMatch(/provider-subject|accessToken|refreshToken/)
    expect(snapshot.backupStoragePolicy).toEqual({
      freeBytes: 1_073_741_824,
      policyVersion: 1,
    })
  })

  it('consumes only the published D1/D4 storage policy, not M6 accounting', async () => {
    const fetch = vi.fn(async () => Response.json(M1_SHARED_V1_POLICY_FIXTURE))
    const api = new XmclAccountApi(fetch)

    const policy = await api.getBackupStoragePolicy(M1_LOCAL_AUTH_FIXTURE.session)

    expect(policy).toEqual({
      freeBytes: 1_073_741_824,
      policyVersion: 1,
    })
  })

  it('rejects M6 accounting fields on the D1/D4 policy endpoint', async () => {
    const api = new XmclAccountApi(async () =>
      Response.json({
        ...M1_SHARED_V1_POLICY_FIXTURE,
        usedBytes: 1,
      }),
    )

    await expect(api.getBackupStoragePolicy(M1_LOCAL_AUTH_FIXTURE.session)).rejects.toThrow(
      'Invalid shared v1 backup storage policy response',
    )
  })

  it('reports identity conflicts without exposing response details', async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        {
          error: 'identity_conflict',
          message: 'must not be surfaced',
          requestId: 'request-1',
          details: {
            mergeId: 'merge-1',
            otherAccount: { email: 'private@example.com' },
          },
        },
        { status: 409 },
      ),
    )
    const api = new XmclAccountApi(fetch)

    const error = await api.launcherExchange('modrinth', 'provider-secret').catch((e) => e)

    expect(error).toBeInstanceOf(XmclAccountApiError)
    expect(error).toMatchObject({
      code: 'identity_conflict',
      mergeId: 'merge-1',
      requestId: 'request-1',
    })
    expect(JSON.stringify(error)).not.toContain('private@example.com')
  })

  it('identifies a Cloudflare Worker plan-limit response', async () => {
    const api = new XmclAccountApi(async () =>
      new Response('error code: 1027\n', {
        status: 429,
        headers: { 'content-type': 'text/plain; charset=UTF-8' },
      }),
    )

    const error = await api.refreshSession(M1_LOCAL_AUTH_FIXTURE.session).catch((e) => e)

    expect(error).toBeInstanceOf(XmclAccountApiError)
    expect(error).toMatchObject({
      status: 429,
      code: 'xmcl_api_plan_limit_exceeded',
    })
  })

  it('prepares and confirms a merge with separate idempotent requests', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          mergeId: 'merge-1',
          resources: [{ type: 'backup', count: 2 }],
        }),
      )
      .mockResolvedValueOnce(Response.json({ taskId: 'task-1' }, { status: 202 }))
    const api = new XmclAccountApi(fetch)

    const preview = await api.prepareMerge(M1_LOCAL_AUTH_FIXTURE.session, {
      provider: 'modrinth',
      credential: 'provider-credential',
      completedAt: '2026-07-22T00:00:00.000Z',
    })
    const taskId = await api.confirmMerge(M1_LOCAL_AUTH_FIXTURE.session, preview.mergeId)

    expect(preview.resources).toEqual([{ type: 'backup', count: 2 }])
    expect(taskId).toBe('task-1')
    const prepareHeaders = fetch.mock.calls[0][1]?.headers
    const confirmHeaders = fetch.mock.calls[1][1]?.headers
    expect(prepareHeaders).toEqual(expect.any(Headers))
    expect((prepareHeaders as Headers).get('Idempotency-Key')).toBeTruthy()
    expect((confirmHeaders as Headers).get('Idempotency-Key')).toBeTruthy()
  })
})

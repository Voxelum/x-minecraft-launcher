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

  it('binds the browser session to the P-256 public JWK submitted at exchange', async () => {
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
    const api = new XmclAccountApi(
      fetch,
      'https://account.example.test/',
      undefined,
      'https://billing.example.test/',
    )

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
    const secondBody = JSON.parse(String(fetch.mock.calls[1]![1]?.body))
    expect(firstUrl.searchParams.has('dpopJwk')).toBe(false)
    expect(secondBody.dpopJwk).toMatchObject({
      kty: 'EC',
      crv: 'P-256',
      x: expect.any(String),
      y: expect.any(String),
    })
  })

  it('retries the DPoP key provider after a transient failure', async () => {
    const fetch = vi.fn(async () => Response.json(M1_LOCAL_AUTH_FIXTURE))
    const key = generateXmclDpopKey()
    const keyProvider = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary secure storage failure'))
      .mockResolvedValue(key)
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/', keyProvider)
    const request = {
      provider: 'discord' as const,
      transactionId: 'transaction-1',
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://127.0.0.1:25555/commercial-auth',
    }

    await expect(api.exchangeBrowser(request)).rejects.toThrow(
      'Temporary secure storage failure',
    )
    await expect(api.exchangeBrowser(request)).resolves.toMatchObject({
      session: { accessToken: 'fixture-access-token' },
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
    const headers = init!.headers as Headers
    const proof = headers.get('DPoP')!
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
    expect(headers.get('Authorization')).toBe(`DPoP ${credential.accessToken}`)
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
    expect(url.searchParams.has('dpopJwk')).toBe(false)
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

  it('claims a Together trial and creates a Waffo checkout with authenticated idempotent requests', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: 'active',
          durationSeconds: 604800,
          turnEgressBytes: 1_000_000_000,
          claimedAt: '2026-08-12T00:00:00.000Z',
          expiresAt: '2026-08-19T00:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          orderId: 'order-1',
          cashAmount: { currency: 'USD', amountMinor: 500 },
          approvalUrl: 'https://checkout.waffo.ai/order-1',
          status: 'pending',
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        }),
      )
    const api = new XmclAccountApi(
      fetch,
      'https://account.example.test/',
      undefined,
      'https://billing.example.test/',
    )

    await api.claimTogetherTrial(M1_LOCAL_AUTH_FIXTURE.session)
    await api.createTogetherOrder(M1_LOCAL_AUTH_FIXTURE.session, 500)

    expect(String(fetch.mock.calls[0]![0])).toBe(
      'https://billing.example.test/v1/xmcl-plus/trial',
    )
    expect(String(fetch.mock.calls[1]![0])).toBe(
      'https://billing.example.test/v1/billing/waffo/orders',
    )
    const trialInit = fetch.mock.calls[0]![1]!
    const orderInit = fetch.mock.calls[1]![1]!
    expect(JSON.parse(String(orderInit.body))).toEqual({ amountMinor: 500 })
    expect((trialInit.headers as Headers).get('Idempotency-Key')).toBeTruthy()
    expect((orderInit.headers as Headers).get('Idempotency-Key')).toBeTruthy()
  })

  it('keeps billing available when the deployment has not published the trial route', async () => {
    const fetch = vi.fn(async (input: string | URL) => {
      const path = new URL(input).pathname
      if (path === '/v1/xmcl-plus/offer') {
        return Response.json({
          offerId: 'xmcl-plus',
          displayName: 'XMCL Together Home',
          monthlyPrice: { currency: 'USD', amountMinor: 299 },
          aiUnitsPerPeriod: 2_000_000,
          turnEgressBytesPerPeriod: 20_000_000_000,
        })
      }
      if (path === '/v1/xmcl-plus/trial') {
        return new Response('Not Found', { status: 404 })
      }
      if (path === '/v1/xmcl-plus/status') return Response.json(null)
      if (path === '/v1/xmcl-plus/allowances') {
        return Response.json({
          sources: [],
          aiUnits: {
            included: 0,
            consumed: 0,
            remaining: 0,
            meteringStatus: 'active',
          },
          turnEgressBytes: {
            included: 20_000_000_000,
            consumed: 2_500_000_000,
            remaining: 17_500_000_000,
            meteringStatus: 'active',
          },
        })
      }
      if (path === '/v1/billing/balance') {
        return Response.json({
          accountId: 'account-1',
          available: { currency: 'USD', amountMinor: 0 },
          reserved: { currency: 'USD', amountMinor: 0 },
        })
      }
      return new Response('Unexpected request', { status: 500 })
    })
    const api = new XmclAccountApi(fetch, 'https://edge.example.test/')

    await expect(api.getTogetherOverview(M1_LOCAL_AUTH_FIXTURE.session)).resolves.toMatchObject({
      trial: {
        status: 'unavailable',
        durationSeconds: 604_800,
        turnEgressBytes: 1_000_000_000,
      },
      subscription: null,
      allowances: {
        turnEgressBytes: {
          included: 20_000_000_000,
          consumed: 2_500_000_000,
          remaining: 17_500_000_000,
        },
      },
      balance: { available: { amountMinor: 0 } },
    })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { CommercialAccountApi, CommercialAccountApiError } from './CommercialAccountApi'
import { M1_LOCAL_AUTH_FIXTURE, M1_SHARED_V1_POLICY_FIXTURE } from './fixtures'

describe('CommercialAccountApi', () => {
  it('keeps provider and XMCL credentials in main-process requests', async () => {
    const fetch = vi.fn(async (_input: string | URL, _init?: RequestInit) => Response.json(M1_LOCAL_AUTH_FIXTURE))
    const api = new CommercialAccountApi(fetch)

    const result = await api.launcherExchange('modrinth', 'provider-secret')

    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(String(init?.body))).toMatchObject({
      loginTransactionId: expect.any(String),
      completedAt: expect.any(String),
      credential: 'provider-secret',
    })
    expect(result.session.accessToken).toBe('fixture-access-token')
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
    const api = new CommercialAccountApi(fetch)

    const authorization = await api.beginBrowserAuthorization('google', {
      state: 'state-1',
      redirectUri: 'http://127.0.0.1:1234/commercial-auth',
      codeChallenge: 'challenge-1',
    })

    expect(authorization.transactionId).toBe('transaction-1')
    const [input, init] = calls[0]!
    const url = new URL(String(input))
    expect(url.pathname).toBe('/v1/auth/google/authorize')
    expect(url.searchParams.get('state')).toBe('state-1')
    expect(url.searchParams.get('redirectUri')).toBe('http://127.0.0.1:1234/commercial-auth')
    expect(url.searchParams.get('codeChallenge')).toBe('challenge-1')
    expect(init?.method).toBe('GET')
  })

  it('strips subjects and session credentials from renderer snapshots', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json(M1_LOCAL_AUTH_FIXTURE.account))
      .mockResolvedValueOnce(Response.json([{
        ...M1_LOCAL_AUTH_FIXTURE.identities![0],
        subject: 'provider-subject',
      }]))
      .mockResolvedValueOnce(Response.json(M1_SHARED_V1_POLICY_FIXTURE))
    const api = new CommercialAccountApi(fetch)

    const snapshot = await api.getSnapshot(M1_LOCAL_AUTH_FIXTURE.session)

    expect(JSON.stringify(snapshot)).not.toMatch(/provider-subject|accessToken|refreshToken/)
    expect(snapshot.backupStoragePolicy).toEqual({
      freeBytes: 1_073_741_824,
      policyVersion: 1,
    })
  })

  it('consumes only the published D1/D4 storage policy, not M6 accounting', async () => {
    const fetch = vi.fn(async () => Response.json(M1_SHARED_V1_POLICY_FIXTURE))
    const api = new CommercialAccountApi(fetch)

    const policy = await api.getBackupStoragePolicy(M1_LOCAL_AUTH_FIXTURE.session)

    expect(policy).toEqual({
      freeBytes: 1_073_741_824,
      policyVersion: 1,
    })
  })

  it('rejects M6 accounting fields on the D1/D4 policy endpoint', async () => {
    const api = new CommercialAccountApi(async () => Response.json({
      ...M1_SHARED_V1_POLICY_FIXTURE,
      usedBytes: 1,
    }))

    await expect(api.getBackupStoragePolicy(M1_LOCAL_AUTH_FIXTURE.session))
      .rejects.toThrow('Invalid shared v1 backup storage policy response')
  })

  it('reports identity conflicts without exposing response details', async () => {
    const fetch = vi.fn(async () => Response.json({
      error: 'identity_conflict',
      message: 'must not be surfaced',
      requestId: 'request-1',
      details: {
        mergeId: 'merge-1',
        otherAccount: { email: 'private@example.com' },
      },
    }, { status: 409 }))
    const api = new CommercialAccountApi(fetch)

    const error = await api.launcherExchange('modrinth', 'provider-secret').catch(e => e)

    expect(error).toBeInstanceOf(CommercialAccountApiError)
    expect(error).toMatchObject({
      code: 'identity_conflict',
      mergeId: 'merge-1',
      requestId: 'request-1',
    })
    expect(JSON.stringify(error)).not.toContain('private@example.com')
  })

  it('prepares and confirms a merge with separate idempotent requests', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({
        mergeId: 'merge-1',
        resources: [{ type: 'backup', count: 2 }],
      }))
      .mockResolvedValueOnce(Response.json({ taskId: 'task-1' }, { status: 202 }))
    const api = new CommercialAccountApi(fetch)

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

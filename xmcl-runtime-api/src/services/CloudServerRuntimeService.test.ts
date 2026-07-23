import { describe, expect, test } from 'vitest'
import {
  CloudServerApiClient,
  CloudServerLogPageSchema,
  CloudServerLogsOptionsSchema,
  CloudServerSchema,
} from './CloudServerService'

const logPage = {
  items: [{
    logId: 'log_01',
    serverId: 'srv_test_01',
    source: 'cloud_server',
    sequence: 1,
    occurredAt: '2026-07-22T14:00:01.000Z',
    stream: 'stdout',
    message: 'Starting',
  }],
  nextCursor: 'cursor_01',
} as const

describe('CloudServerService public runtime API', () => {
  test('strictly identifies remote logs and omits worker credentials', () => {
    expect(CloudServerLogPageSchema.parse(logPage)).toEqual(logPage)
    expect(CloudServerLogPageSchema.safeParse({
      ...logPage,
      items: [{ ...logPage.items[0], source: 'client' }],
    }).success).toBe(false)
    expect(CloudServerLogPageSchema.safeParse({ ...logPage, workerToken: 'not-public' }).success).toBe(false)
    expect(CloudServerSchema.safeParse({
      serverId: 'srv_test_01',
      accountId: 'acct_test_01',
      provider: 'vultr',
      region: 'taipei',
      status: 'running',
      desiredStatus: 'running',
      statusVersion: 1,
      workerToken: 'not-public',
    }).success).toBe(false)
  })

  test('validates bounded public log queries', () => {
    expect(CloudServerLogsOptionsSchema.parse({
      serverId: 'srv_test_01',
      cursor: 'cursor_01',
      limit: 100,
    })).toEqual({
      serverId: 'srv_test_01',
      cursor: 'cursor_01',
      limit: 100,
    })
    expect(CloudServerLogsOptionsSchema.safeParse({ serverId: 'srv_test_01', limit: 501 }).success).toBe(false)
  })

  test('calls only the public server logs endpoint', async () => {
    let requestedUrl = ''
    const client = new CloudServerApiClient({
      baseUrl: 'https://m5.test',
      getSessionToken: () => undefined,
      fetch: (async (input) => {
        requestedUrl = input.toString()
        return new Response(JSON.stringify(logPage), {
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof globalThis.fetch,
    })

    await expect(client.getServerLogs({
      serverId: 'srv_test_01',
      cursor: 'cursor_01',
      limit: 100,
    })).resolves.toEqual(logPage)
    expect(requestedUrl).toBe('https://m5.test/v1/servers/srv_test_01/logs?cursor=cursor_01&limit=100')
    expect(requestedUrl).not.toContain('/internal/')
  })
})

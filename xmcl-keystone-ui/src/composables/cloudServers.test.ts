import {
  CloudServerApiErrorSchema,
  CloudServerLogPageSchema,
  CloudServerSchema,
  type CloudServer,
  type CloudServerLogPage,
} from '@xmcl/runtime-api'
import { ref } from 'vue'
import { describe, expect, test } from 'vitest'
import fixture from '../../../docs/commercialization/m5-minecraft-runtime/proposals/v1/fixtures/launcher-runtime.json'
import { mapCloudServerIssue, mergeCloudServerLogs, mergeCloudServerSnapshot, useCloudServer } from './cloudServers'

const cases = new Map(fixture.cases.map(item => [item.name, item]))

describe('cloud server runtime mapping', () => {
  test('uses the service snapshot for connection and ignores out-of-order status', () => {
    const success = CloudServerSchema.parse(cases.get('runtime-success')!.response)
    const responses = cases.get('runtime-out-of-order')!.responses!.map(value => CloudServerSchema.parse(value))

    let current: CloudServer | undefined = success
    for (const response of responses) {
      current = mergeCloudServerSnapshot(current, response, 'srv_test_01')
    }

    expect(current?.status).toBe('running')
    expect(current?.statusVersion).toBe(10)
    expect(current?.address).toBe('mc-test.example.net:25565')
  })

  test('deduplicates, orders, and identifies cloud logs separately from client logs', () => {
    const page = CloudServerLogPageSchema.parse(cases.get('logs-duplicate-and-out-of-order')!.response)
    const merged = mergeCloudServerLogs([], page.items, 'srv_test_01')

    expect(merged.map(log => log.logId)).toEqual(['log_01', 'log_02'])
    expect(merged.every(log => log.source === 'cloud_server')).toBe(true)
  })

  test('keeps a retried log page idempotent', () => {
    const pages = cases.get('logs-idempotent-retry')!.responses!
      .map(value => CloudServerLogPageSchema.parse(value)) as CloudServerLogPage[]
    const merged = pages.reduce(
      (logs, page) => mergeCloudServerLogs(logs, page.items, 'srv_test_01'),
      [] as CloudServerLogPage['items'],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0].logId).toBe('log_02')
  })

  test('maps balance rejection and status conflict without client-side policy', () => {
    const balanceError = CloudServerApiErrorSchema.parse(cases.get('insufficient-balance')!.response)
    const conflictError = CloudServerApiErrorSchema.parse(cases.get('status-conflict')!.response)

    expect(mapCloudServerIssue(balanceError)).toBe('insufficient_balance')
    expect(mapCloudServerIssue(conflictError)).toBe('status_conflict')
    expect(mapCloudServerIssue({ errorCode: 'server_state_conflict' })).toBe('status_conflict')
  })

  test('loads connection, status, and remote logs through CloudServerService', async () => {
    const server = CloudServerSchema.parse(cases.get('runtime-success')!.response)
    const page = CloudServerLogPageSchema.parse(cases.get('logs-duplicate-and-out-of-order')!.response)
    const service = {
      getServer: async (serverId: string) => {
        expect(serverId).toBe('srv_test_01')
        return server
      },
      getServerLogs: async (options: { serverId: string }) => {
        expect(options.serverId).toBe('srv_test_01')
        return page
      },
    }
    const model = useCloudServer(ref('srv_test_01'), service)

    await model.refreshRuntime()
    await model.refreshLogs()

    expect(model.runtimeStatus.value).toBe('running')
    expect(model.connectionAddress.value).toBe('mc-test.example.net:25565')
    expect(model.cloudServerLogs.value.map(log => log.logId)).toEqual(['log_01', 'log_02'])
  })
})

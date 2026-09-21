import { BaseServiceKey } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'
import { createRendererTelemetry, createServiceCalls } from './serviceBridge'

describe('DeskGap renderer bridge', () => {
  it('forwards both traced and ordinary calls through the same response decoder', async () => {
    const invoke = vi.fn().mockResolvedValue({ result: { version: '0.69.0' } })
    const receive = vi.fn().mockResolvedValue({ version: '0.69.0' })
    const calls = createServiceCalls(BaseServiceKey, invoke, receive)
    const trace = { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', actionId: 'update-check' }
    expect(await calls.callWithTrace(trace, 'getEnvironment')).toEqual({ version: '0.69.0' })
    expect(invoke).toHaveBeenLastCalledWith('service-call-traced', trace, BaseServiceKey, 'getEnvironment')
    await calls.call('getEnvironment')
    expect(invoke).toHaveBeenLastCalledWith('service-call', BaseServiceKey, 'getEnvironment')
    expect(receive).toHaveBeenCalledTimes(2)
  })

  it('exposes every current renderer telemetry operation without dropping failures', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const telemetry = createRendererTelemetry(invoke)
    await telemetry.trackException({ name: 'Error', message: 'fixture' })
    await telemetry.startAction({ name: 'update.check' })
    await telemetry.endAction({ id: 'action', outcome: 'success' })
    await telemetry.flush()
    expect(invoke.mock.calls).toEqual([
      ['renderer-telemetry-exception', { name: 'Error', message: 'fixture' }],
      ['renderer-telemetry-action-start', { name: 'update.check' }],
      ['renderer-telemetry-action-end', { id: 'action', outcome: 'success' }],
      ['renderer-telemetry-flush'],
    ])
    invoke.mockRejectedValueOnce(new Error('disconnected'))
    await expect(telemetry.flush()).rejects.toThrow('disconnected')
  })
})

import type { RendererTelemetryChannel } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startRendererServiceTrace, withRendererAction } from './rendererAction'
import { setRendererTelemetryEnabled, trackRendererException } from './telemetry'

vi.mock('./i18n', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
    },
  },
}))

describe('renderer telemetry bridge', () => {
  afterEach(() => {
    setRendererTelemetryEnabled(true)
    vi.unstubAllGlobals()
  })

  it('forwards renderer exceptions through the preload channel', async () => {
    const channel: RendererTelemetryChannel = {
      trackException: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      startAction: vi.fn().mockResolvedValue(undefined),
      endAction: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('rendererTelemetry', channel)

    const exception = new TypeError('renderer failed')
    await trackRendererException(exception)

    expect(channel.trackException).toHaveBeenCalledWith({
      name: 'TypeError',
      message: 'renderer failed',
      stack: exception.stack,
      properties: undefined,
    })
  })

  it('does not forward ignored or disabled telemetry', async () => {
    const channel: RendererTelemetryChannel = {
      trackException: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      startAction: vi.fn().mockResolvedValue(undefined),
      endAction: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('rendererTelemetry', channel)

    await trackRendererException(
      new Error('ResizeObserver loop completed with undelivered notifications'),
    )
    setRendererTelemetryEnabled(false)
    await trackRendererException(new Error('disabled'))

    expect(channel.trackException).not.toHaveBeenCalled()
  })

  it('does not resend errors already recorded by a runtime service span', async () => {
    const channel: RendererTelemetryChannel = {
      trackException: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      startAction: vi.fn().mockResolvedValue(undefined),
      endAction: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('rendererTelemetry', channel)

    await trackRendererException({
      name: 'RuntimeError',
      message: 'service failed',
      stack: 'remote stack',
      origin: 'runtime-service',
      serviceName: 'ExampleService',
      serviceMethod: 'run',
    })

    expect(channel.trackException).not.toHaveBeenCalled()
  })

  it('reuses an action context for explicitly scoped service calls', async () => {
    const actionContext = {
      id: 'action-id',
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    }
    const channel: RendererTelemetryChannel = {
      trackException: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      startAction: vi.fn().mockResolvedValue(actionContext),
      endAction: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('rendererTelemetry', channel)

    const serviceContext = await withRendererAction(
      'user_action.minecraft.launch',
      async (action) => action.run(() => startRendererServiceTrace().context),
    )

    expect(serviceContext).toEqual({
      traceparent: actionContext.traceparent,
      actionId: actionContext.id,
    })
    expect(channel.endAction).toHaveBeenCalledWith({
      id: actionContext.id,
      outcome: 'success',
    })
  })

  it('identifies runtime service errors when ending an action', async () => {
    const actionContext = {
      id: 'action-id',
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    }
    const channel: RendererTelemetryChannel = {
      trackException: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
      startAction: vi.fn().mockResolvedValue(actionContext),
      endAction: vi.fn().mockResolvedValue(true),
    }
    vi.stubGlobal('rendererTelemetry', channel)
    const error = {
      name: 'RuntimeError',
      message: 'service failed',
      stack: 'remote stack',
      origin: 'runtime-service',
    }

    await expect(
      withRendererAction('user_action.instance.install', async () => {
        throw error
      }),
    ).rejects.toBe(error)
    expect(channel.endAction).toHaveBeenCalledWith({
      id: actionContext.id,
      outcome: 'error',
      error: {
        name: 'RuntimeError',
        message: 'service failed',
        stack: 'remote stack',
        origin: 'runtime-service',
      },
    })
  })
})

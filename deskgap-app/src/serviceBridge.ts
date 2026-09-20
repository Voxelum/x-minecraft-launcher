import type { RendererTelemetryChannel, ServiceChannel, ServiceKey } from '@xmcl/runtime-api'

type Invoke = <T>(channel: string, ...args: unknown[]) => Promise<T>

export function createServiceCalls<T>(
  serviceKey: ServiceKey<T>,
  invoke: Invoke,
  receive: (response: unknown) => Promise<any>,
): Pick<ServiceChannel<T>, 'call' | 'callWithTrace'> {
  return {
    async call(method, ...payload) {
      return receive(await invoke('service-call', serviceKey, method, ...payload))
    },
    async callWithTrace(traceContext, method, ...payload) {
      return receive(await invoke('service-call-traced', traceContext, serviceKey, method, ...payload))
    },
  }
}

export function createRendererTelemetry(invoke: Invoke): RendererTelemetryChannel {
  return {
    trackException: exception => invoke('renderer-telemetry-exception', exception),
    flush: () => invoke('renderer-telemetry-flush'),
    startAction: action => invoke('renderer-telemetry-action-start', action),
    endAction: action => invoke('renderer-telemetry-action-end', action),
  }
}

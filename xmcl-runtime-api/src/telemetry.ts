import type { ServiceCallTraceContext } from './service'

export type RendererTelemetryAttribute = string | number | boolean

export interface RendererExceptionTelemetry {
  name: string
  message: string
  stack?: string
  properties?: Record<string, string | number | boolean>
}

export interface RendererActionContext extends ServiceCallTraceContext {
  id: string
}

export interface RendererActionStart {
  name: string
  attributes?: Record<string, RendererTelemetryAttribute>
}

export interface RendererActionEnd {
  id: string
  outcome: 'success' | 'error' | 'cancelled'
  error?: {
    name: string
    message: string
    stack?: string
    origin?: 'runtime-service' | 'renderer'
  }
  attributes?: Record<string, RendererTelemetryAttribute>
}

export interface RendererTelemetryChannel {
  trackException(exception: RendererExceptionTelemetry): Promise<void>
  flush(): Promise<void>
  startAction(action: RendererActionStart): Promise<RendererActionContext | undefined>
  endAction(action: RendererActionEnd): Promise<boolean>
}

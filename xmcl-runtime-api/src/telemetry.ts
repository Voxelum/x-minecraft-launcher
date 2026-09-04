import type { ServiceCallTraceContext } from './service'

export const APP_INSIGHT_KEY =
  'InstrumentationKey=3db62cee-dd9b-4622-9884-e44d8403f2bc;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=be48ffb5-2543-4ab6-a75c-37ef9deda34a'

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

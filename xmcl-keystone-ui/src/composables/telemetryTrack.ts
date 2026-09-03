import { setRendererTelemetryEnabled } from '@/telemetry'
import type { Settings, SharedState } from '@xmcl/runtime-api'
import type { Ref } from 'vue'

export function useTelemetryTrack(settings: Ref<SharedState<Settings> | undefined>) {
  watch(
    settings,
    (s, _, onCleanup) => {
      if (!s) return
      setRendererTelemetryEnabled(!s.disableTelemetry)
      const onDisableTelemetrySet = (v: boolean) => {
        setRendererTelemetryEnabled(!v)
      }
      s.subscribe('disableTelemetrySet', onDisableTelemetrySet)
      onCleanup(() => s.unsubscribe('disableTelemetrySet', onDisableTelemetrySet))
    },
    { immediate: true },
  )
}

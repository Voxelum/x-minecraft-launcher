import { setRendererTelemetryEnabled } from '@/telemetry'
import type { Settings, SharedState } from '@xmcl/runtime-api'
import type { Ref } from 'vue'

export function useTelemetryTrack(settings: Ref<SharedState<Settings> | undefined>) {
  watch(
    settings,
    (s, _, onCleanup) => {
      if (!s) return
      // Fail-closed: telemetry only runs on explicit consent.
      setRendererTelemetryEnabled(s.telemetryConsent === 'granted')
      const onConsentSet = (v: 'unset' | 'granted' | 'denied') => {
        setRendererTelemetryEnabled(v === 'granted')
      }
      s.subscribe('telemetryConsentSet', onConsentSet)
      onCleanup(() => s.unsubscribe('telemetryConsentSet', onConsentSet))
    },
    { immediate: true },
  )
}

import { ApplicationInsights } from '@microsoft/applicationinsights-web'
import { APP_INSIGHT_KEY } from '@xmcl/runtime-api'
import { i18n } from './i18n'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: APP_INSIGHT_KEY,
    disableCookiesUsage: true,
    disableFetchTracking: true,
    disableAjaxTracking: true,
  },
})
appInsights.loadAppInsights()

// Add telemetry initializer to filter exceptions and enrich the ones we
// want to investigate with renderer-side context.
//
// See issue #1427: the previous version wrote `exception.locale = ...`
// directly to `envelope.data`, but the App Insights JS SDK promotes
// custom dimensions through `envelope.baseData.properties`, so the
// locale never reached `customDimensions` and the App Insights query
// `extend locale = tostring(customDimensions.locale)` came back empty
// for all 8 869 matching events / 902 users in a 14d window.
appInsights.addTelemetryInitializer((envelope) => {
  if (envelope.baseType === 'ExceptionData') {
    const exception = envelope.data
    if (exception && exception.message) {
      if (exception.message.includes('ResizeObserver loop')) {
        return false
      }
      if (exception.message.includes('onMounted is called when there')) {
        return false
      }
      if (exception.message.includes('Failed to fetch')) {
        return false
      }
      if (exception.message.includes('SyntaxError: {"code":24}')) {
        const baseData: any = envelope.baseData = envelope.baseData ?? {}
        const properties = baseData.properties = baseData.properties ?? {}
        try {
          properties.locale = (i18n.global.locale as any).value
        } catch {}
        try {
          // The renderer uses createWebHashHistory, so the active route
          // lives in window.location.hash (e.g. "#/mod/foo"). Capturing
          // it lets us narrow the broken translation key to a single
          // screen in the next release.
          properties.route = typeof window !== 'undefined' ? window.location.hash : ''
        } catch {}
        // Keep the legacy field for back-compat in case anything else
        // reads it off `envelope.data`.
        ;(exception as any).locale = properties.locale
      }
    }
  }
  return true
})


export { appInsights }

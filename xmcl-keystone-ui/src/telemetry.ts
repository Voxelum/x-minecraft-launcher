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

// Add telemetry initializer to filter exceptions
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
      // Vuetify VChip wheel handler can fire on an already-unmounted node;
      // it calls getComputedStyle on a non-Element. Sharply trending down
      // since 0.56.1 already (issue #1426), this filter drops the tail
      // noise from old versions so we can see new regressions clearly.
      if (exception.message.includes("Failed to execute 'getComputedStyle' on 'Window'")) {
        return false
      }
      // Vuetify VTextField wheel/affix paths against the v3->v4 upgrade.
      // Trending down since 0.56.x already (issue #1430).
      if (exception.message.includes('onAffixClick is not a function')) {
        return false
      }
      if (exception.message.includes('An object could not be cloned')) {
        return false
      }
      if (exception.message.includes('SyntaxError: {"code":24}')) {
        exception.locale = (i18n.global.locale as any).value
      }
    }
  }
  return true
})


export { appInsights }

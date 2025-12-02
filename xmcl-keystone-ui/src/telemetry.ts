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
      if (exception.message.include('SyntaxError: {"code":24}')) {
        exception.locale = i18n.locale
      }
    }
  }
  return true
})


export { appInsights }

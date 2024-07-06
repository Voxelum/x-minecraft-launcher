import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: 'InstrumentationKey=294f3664-8208-4963-a2b0-62405ff9d48e;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/',
    disableCookiesUsage: true,
    disableFetchTracking: true,
    samplingPercentage: 20,
  },
})

appInsights.loadAppInsights()

export { appInsights }

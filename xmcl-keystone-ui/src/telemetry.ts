import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: 'InstrumentationKey=3db62cee-dd9b-4622-9884-e44d8403f2bc;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=be48ffb5-2543-4ab6-a75c-37ef9deda34a',
    disableCookiesUsage: true,
    disableFetchTracking: true,
    disableAjaxTracking: true,
  },
})

appInsights.loadAppInsights()

export { appInsights }

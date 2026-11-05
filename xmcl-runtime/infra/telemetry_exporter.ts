const STATSBEAT_DISABLED = 'APPLICATIONINSIGHTS_STATSBEAT_DISABLED'
const SDK_STATS_DISABLED = 'APPLICATIONINSIGHTS_SDKSTATS_DISABLED'
const RESOURCE_METRIC_DISABLED = 'APPLICATIONINSIGHTS_OPENTELEMETRY_RESOURCE_METRIC_DISABLED'

/** Keep legacy Azure SDK diagnostics disabled if an optional package loads it. */
export function disableAzureMonitorDiagnostics() {
  process.env[STATSBEAT_DISABLED] ??= 'true'
  process.env[SDK_STATS_DISABLED] ??= 'true'
  process.env[RESOURCE_METRIC_DISABLED] ??= 'true'
}

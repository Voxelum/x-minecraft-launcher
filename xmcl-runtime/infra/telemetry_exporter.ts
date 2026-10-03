const STATSBEAT_DISABLED = 'APPLICATIONINSIGHTS_STATSBEAT_DISABLED'
const SDK_STATS_DISABLED = 'APPLICATIONINSIGHTS_SDKSTATS_DISABLED'
const RESOURCE_METRIC_DISABLED = 'APPLICATIONINSIGHTS_OPENTELEMETRY_RESOURCE_METRIC_DISABLED'

/**
 * The launcher exports its own traces and logs. Azure Monitor's exporter
 * diagnostics and resource metrics are not part of that contract and can
 * consume the client's ingestion quota.
 */
export function disableAzureMonitorDiagnostics() {
  process.env[STATSBEAT_DISABLED] ??= 'true'
  // Newer Azure Monitor SDKs use SDKSTATS; beta.44 still reads STATSBEAT.
  process.env[SDK_STATS_DISABLED] ??= 'true'
  process.env[RESOURCE_METRIC_DISABLED] ??= 'true'
}

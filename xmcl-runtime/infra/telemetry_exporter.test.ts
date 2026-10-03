import { afterEach, describe, expect, it } from 'vitest'
import { disableAzureMonitorDiagnostics } from './telemetry_exporter'

const statsbeatKey = 'APPLICATIONINSIGHTS_STATSBEAT_DISABLED'
const sdkStatsKey = 'APPLICATIONINSIGHTS_SDKSTATS_DISABLED'
const resourceMetricKey = 'APPLICATIONINSIGHTS_OPENTELEMETRY_RESOURCE_METRIC_DISABLED'

describe('Azure Monitor exporter configuration', () => {
  const original = {
    statsbeat: process.env[statsbeatKey],
    sdkStats: process.env[sdkStatsKey],
    resourceMetric: process.env[resourceMetricKey],
  }

  afterEach(() => {
    if (original.statsbeat === undefined) delete process.env[statsbeatKey]
    else process.env[statsbeatKey] = original.statsbeat
    if (original.sdkStats === undefined) delete process.env[sdkStatsKey]
    else process.env[sdkStatsKey] = original.sdkStats
    if (original.resourceMetric === undefined) delete process.env[resourceMetricKey]
    else process.env[resourceMetricKey] = original.resourceMetric
  })

  it('disables exporter diagnostics and resource metrics by default', () => {
    delete process.env[statsbeatKey]
    delete process.env[sdkStatsKey]
    delete process.env[resourceMetricKey]

    disableAzureMonitorDiagnostics()

    expect(process.env[statsbeatKey]).toBe('true')
    expect(process.env[sdkStatsKey]).toBe('true')
    expect(process.env[resourceMetricKey]).toBe('true')
  })

  it('preserves an explicit exporter setting', () => {
    process.env[statsbeatKey] = 'false'
    process.env[sdkStatsKey] = 'false'
    process.env[resourceMetricKey] = 'false'

    disableAzureMonitorDiagnostics()

    expect(process.env[statsbeatKey]).toBe('false')
    expect(process.env[sdkStatsKey]).toBe('false')
    expect(process.env[resourceMetricKey]).toBe('false')
  })
})

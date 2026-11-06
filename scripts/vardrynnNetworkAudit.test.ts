import { describe, expect, it } from 'vitest'
import { auditBundle, auditNetworkLog, auditUndiciLog } from './vardrynnNetworkAudit'

describe('Vardrynn artifact and traffic audit', () => {
  it('fails on restored update download or telemetry destinations in a bundle', () => {
    expect(auditBundle('fetch("https://api.xmcl.app/latest")')).not.toHaveLength(0)
    expect(auditBundle('"https://github.com/Voxelum/x-minecraft-launcher/releases/download/v1/app.asar"')).not.toHaveLength(0)
    expect(auditBundle('"https://westus-0.in.applicationinsights.azure.com/v2/track"')).not.toHaveLength(0)
  })

  it('allows attribution and service origins retained behind the runtime guard', () => {
    expect(auditBundle('"https://www.xmcl.app"; "https://api.xmcl.app"')).toEqual([])
  })

  it('fails on upstream URLs or DNS hostnames recorded by Chromium', () => {
    expect(auditNetworkLog({ events: [{ params: { url: 'https://api.xmcl.app/news' } }] })).not.toHaveLength(0)
    expect(auditNetworkLog({ events: [{ params: { host: 'signaling.xmcl.app:443' } }] })).not.toHaveLength(0)
    expect(auditNetworkLog({ events: [{ params: { url: 'https://dc.services.visualstudio.com/v2/track' } }] })).not.toHaveLength(0)
  })

  it('allows provider traffic and ignores URL strings in the logging schema', () => {
    expect(auditNetworkLog({
      constants: { description: 'https://api.xmcl.app' },
      events: [{ params: { url: 'https://api.modrinth.com/v2/project' } }],
    })).toEqual([])
  })

  it('distinguishes historical server preferences from requests in the capture', () => {
    const constants = { logEventTypes: { HTTP_SERVER_PROPERTIES_UPDATE_CACHE: 100, HTTP_SERVER_PROPERTIES_UPDATE_PREFS: 101, URL_REQUEST_START_JOB: 102 } }
    const cache = { type: 100, params: { servers: [{ server: 'https://api.xmcl.app' }] } }
    expect(auditNetworkLog({ constants, events: [cache] })).toEqual([])
    expect(auditNetworkLog({ constants, events: [cache, { type: 102, params: { url: 'https://api.xmcl.app/latest' } }] })).not.toHaveLength(0)
  })

  it('rejects missing or malformed captures instead of passing an empty audit', () => {
    expect(() => auditNetworkLog({})).toThrow()
  })

  it('audits requests actually sent by Undici separately from locally denied attempts', () => {
    expect(auditUndiciLog('[INFO] [undici] client:sendHeaders GET https://api.xmcl.app/latest 1.2.3.4')).not.toHaveLength(0)
    expect(auditUndiciLog('[INFO] [undici] client:sendHeaders POST https://dc.services.visualstudio.com/v2/track 1.2.3.4')).not.toHaveLength(0)
    expect(auditUndiciLog('[INFO] [undici] client:sendHeaders GET https://api.modrinth.com/v2/project 1.2.3.4\n[WARN] Upstream launcher service is disabled: https://api.xmcl.app/latest')).toEqual([])
  })
})

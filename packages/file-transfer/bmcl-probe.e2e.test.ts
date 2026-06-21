/**
 * BMCLAPI shape probe (live network — opt-in).
 *
 * Run with:  BMCL_PROBE=1 npx vitest run packages/file-transfer/bmcl-probe.e2e.test.ts
 *
 * It does NOT assert launcher behaviour; it records the *actual* shape of
 * BMCLAPI so we can tune the adaptive controller against reality:
 *   - Does a bmcl request 302-redirect to a different mirror host?
 *   - Do mirrors honour `Range` (206 / Accept-Ranges)?
 *   - Does re-requesting the same signed path re-assign a different mirror?
 *   - What are the redirect/TTFB latencies (to set warmup & reconnect cost)?
 *
 * The trace is written to bench-out/bmcl-trace.json and printed to stdout.
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { describe, expect, it } from 'vitest'
import { Agent, interceptors, request } from 'undici'

const BMCL = 'https://bmclapi2.bangbang93.com'
const run = process.env.BMCL_PROBE ? describe : describe.skip

function replaceHost(url: string, host: string) {
  const u = new URL(url)
  u.host = new URL(host).host
  return u.toString()
}

interface Hop {
  url: string
  status: number
  location?: string
  host: string
  acceptRanges?: string
  contentRange?: string
  contentLength?: string
  ms: number
}

const agent = new Agent({ connect: { timeout: 15_000 } })
const redirecting = agent.compose(interceptors.redirect({ maxRedirections: 5 }))

/** Follow redirects manually so we can see every hop + timing. */
async function trace(url: string, headers: Record<string, string> = {}): Promise<Hop[]> {
  const hops: Hop[] = []
  let current = url
  for (let i = 0; i < 6; i++) {
    const t0 = performance.now()
    // undici does not follow redirects by default, so each request stops
    // at the 3xx and exposes the Location header for the next hop.
    const res = await request(current, {
      method: 'GET',
      headers,
      dispatcher: agent,
    })
    const ms = performance.now() - t0
    const location =
      typeof res.headers.location === 'string' ? res.headers.location : undefined
    hops.push({
      url: current,
      status: res.statusCode,
      location,
      host: new URL(current).host,
      acceptRanges: res.headers['accept-ranges'] as string | undefined,
      contentRange: res.headers['content-range'] as string | undefined,
      contentLength: res.headers['content-length'] as string | undefined,
      ms,
    })
    // We only need the headers; abort the body so a 200 mirror response
    // does not download the whole (possibly 25 MB) payload. Swallow the
    // resulting AbortError so it does not surface as an uncaught error.
    res.body.on('error', () => {})
    res.body.destroy()
    if (res.statusCode >= 300 && res.statusCode < 400 && location) {
      current = new URL(location, current).toString()
    } else {
      break
    }
  }
  return hops
}

/** Time to first body byte from a (possibly redirecting) url. */
async function timeToFirstByte(url: string, headers: Record<string, string> = {}) {
  const t0 = performance.now()
  const res = await request(url, { method: 'GET', headers, dispatcher: redirecting })
  let firstByte = -1
  let total = 0
  for await (const chunk of res.body) {
    if (firstByte < 0) firstByte = performance.now() - t0
    total += chunk.length
    if (total > 256 * 1024) break // enough to sample throughput
  }
  const elapsed = performance.now() - t0
  res.body.destroy()
  return { status: res.statusCode, firstByteMs: firstByte, sampledBytes: total, elapsedMs: elapsed }
}

run('BMCLAPI shape probe', () => {
  const result: any = { probedAt: new Date().toISOString(), resources: {}, reassignment: {} }

  it(
    'captures redirect / range / reassignment shape',
    async () => {
      // 1. Resolve a concrete version json from bmcl.
      const manifest: any = await (await fetch(`${BMCL}/mc/game/version_manifest.json`)).json()
      const release = manifest.versions.find((v: any) => v.id === '1.20.1') ?? manifest.versions[0]
      const jsonUrl = replaceHost(release.url, BMCL)
      const version: any = await (await fetch(jsonUrl)).json()

      // 2. Build the same bmcl URL shapes the launcher requests.
      const clientUrl = replaceHost(version.downloads.client.url, BMCL)
      const lib = version.libraries.find((l: any) => l.downloads?.artifact?.path)
      const libUrl = `${BMCL}/maven/${lib.downloads.artifact.path}`

      const assetIndex: any = await (
        await fetch(replaceHost(version.assetIndex.url, BMCL))
      ).json()
      const firstAsset = Object.values<any>(assetIndex.objects)[0]
      const head = firstAsset.hash.substring(0, 2)
      const assetUrl = `${BMCL}/assets/${head}/${firstAsset.hash}`

      const targets: Record<string, { url: string; size?: number }> = {
        versionJson: { url: jsonUrl },
        clientJar: { url: clientUrl, size: version.downloads.client.size },
        library: { url: libUrl, size: lib.downloads.artifact.size },
        asset: { url: assetUrl, size: firstAsset.size },
      }

      for (const [name, t] of Object.entries(targets)) {
        const hops = await trace(t.url, { Range: 'bytes=0-1023' })
        const ttfb = await timeToFirstByte(t.url)
        result.resources[name] = { ...t, hops, ttfb }
      }

      // 3. Re-request the same signed path several times to see whether
      //    bmcl re-assigns a different mirror host.
      const hostsSeen: string[] = []
      for (let i = 0; i < 4; i++) {
        const hops = await trace(clientUrl, { Range: 'bytes=0-0' })
        const finalHost = hops[hops.length - 1].host
        hostsSeen.push(finalHost)
      }
      result.reassignment = {
        url: clientUrl,
        finalHosts: hostsSeen,
        uniqueHosts: [...new Set(hostsSeen)],
      }

      mkdirSync(join(__dirname, '../../bench-out'), { recursive: true })
      const out = join(__dirname, '../../bench-out/bmcl-trace.json')
      writeFileSync(out, JSON.stringify(result, null, 2))
      // eslint-disable-next-line no-console
      console.log('\n===== BMCL TRACE =====\n' + JSON.stringify(result, null, 2) + '\n')
      // eslint-disable-next-line no-console
      console.log('written to', out)

      // Minimal sanity so the run is meaningful when network is available.
      expect(result.resources.clientJar.hops.length).toBeGreaterThan(0)
    },
    120_000,
  )
})

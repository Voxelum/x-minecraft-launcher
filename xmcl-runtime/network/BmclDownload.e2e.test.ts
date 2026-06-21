/**
 * Live end-to-end check of the adaptive bmcl download path (opt-in).
 *
 * Run with:
 *   BMCL_PROBE=1 npx vitest run xmcl-runtime/network/BmclDownload.e2e.test.ts
 *
 * Downloads a real BMCLAPI client jar through the production `download()`
 * primitive driven by {@link BmclDownloadController} (range-split across
 * mirrors + adaptive re-roll), then verifies the sha1. It also prints the
 * achieved throughput and the set of mirror hosts that actually served
 * bytes, so we can confirm the multi-mirror parallelism is real.
 */
import { download } from '@xmcl/file-transfer'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { mkdtemp, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { performance } from 'perf_hooks'
import { Agent, interceptors } from 'undici'
import { describe, expect, it } from 'vitest'
import { BmclDownloadController } from './BmclDownloadController'
import type { DownloadResult } from '@xmcl/file-transfer'

const BMCL = 'https://bmclapi2.bangbang93.com'
const run = process.env.BMCL_PROBE ? describe : describe.skip

function replaceHost(url: string, host: string) {
  const u = new URL(url)
  u.host = new URL(host).host
  return u.toString()
}

async function sha1(file: string) {
  const hash = createHash('sha1')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

run('BMCLAPI adaptive download e2e', () => {
  it(
    'downloads a real client jar via range-split + re-roll and verifies sha1',
    async () => {
      const manifest: any = await (await fetch(`${BMCL}/mc/game/version_manifest.json`)).json()
      const release = manifest.versions.find((v: any) => v.id === '1.20.1') ?? manifest.versions[0]
      const version: any = await (await fetch(replaceHost(release.url, BMCL))).json()
      const client = version.downloads.client
      const url = replaceHost(client.url, BMCL)

      const reports: DownloadResult[] = []
      const controller = new BmclDownloadController({ warmup: 1500, ttfbDeadline: 6000, maxResumes: 12 })
      controller.setReassignableHosts([new URL(BMCL).hostname])
      const origReport = controller.report.bind(controller)
      controller.report = (r) => {
        reports.push(r)
        origReport(r)
      }

      // A dispatcher with production-like timeouts so a stalled mirror
      // surfaces as an error (and re-rolls) instead of hanging.
      const dispatcher = new Agent({
        connections: 16,
        headersTimeout: 15_000,
        bodyTimeout: 10_000,
      }).compose(
        interceptors.retry({ maxRetries: 2 }),
        interceptors.redirect({ maxRedirections: 5 }),
      )

      const dir = await mkdtemp(join(tmpdir(), 'xmcl-bmcl-'))
      try {
        const dest = join(dir, 'client.jar')
        const t0 = performance.now()
        await download({
          url,
          destination: dest,
          controller,
          dispatcher,
          expectedTotal: client.size,
        })
        const ms = performance.now() - t0

        const size = (await stat(dest)).size
        const digest = await sha1(dest)
        const mirrors = [...new Set(reports.map((r) => r.host).filter(Boolean))]
        const stats = {
          size,
          ms: Math.round(ms),
          speedMiBs: Number(((size / 1024 / 1024) / (ms / 1000)).toFixed(2)),
          attempts: reports.length,
          mirrors,
        }
        const { mkdirSync, writeFileSync } = await import('fs')
        mkdirSync(join(__dirname, '../../bench-out'), { recursive: true })
        writeFileSync(
          join(__dirname, '../../bench-out/bmcl-download.json'),
          JSON.stringify(stats, null, 2),
        )

        expect(size).toBe(client.size)
        expect(digest).toBe(client.sha1)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    },
    180_000,
  )
})

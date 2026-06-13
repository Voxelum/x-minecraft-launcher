import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import bundledIndex from './zulu.json'
import { getZuluJRE, setupZuluCache } from './zulu'

// Build a per-test temp appDataPath so cache writes are isolated.
function makeApp(fetchImpl: (url: string, init: any) => Promise<Response>) {
  const dir = mkdtempSync(join(tmpdir(), 'xmcl-zulu-'))
  return {
    appDataPath: dir,
    fetch: fetchImpl,
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  }
}

describe('zulu', () => {
  describe('getZuluJRE', () => {
    test('falls back to bundled index when on-disk cache is missing keys (#1459)', async () => {
      const app = makeApp(() => Promise.resolve(new Response('', { status: 304 })))
      try {
        // Simulate a corrupted on-disk cache that parses but lacks the
        // required `java-runtime-*` arrays (the regression).
        writeFileSync(
          join(app.appDataPath, 'zulu.json'),
          JSON.stringify({ modified: 'broken', 'java-runtime-alpha': [] }),
        )
        const jre = await getZuluJRE(app as any, 'java-runtime-gamma')
        expect(jre).toBeDefined()
        expect(jre.url).toMatch(/^https?:\/\//)
      } finally {
        app.dispose()
      }
    })

    test('falls back to bundled index when on-disk cache is unparseable', async () => {
      const app = makeApp(() => Promise.resolve(new Response('', { status: 304 })))
      try {
        writeFileSync(join(app.appDataPath, 'zulu.json'), '{not json')
        const jre = await getZuluJRE(app as any, 'java-runtime-gamma')
        expect(jre).toBeDefined()
      } finally {
        app.dispose()
      }
    })

    test('error message records which sources were tried', async () => {
      const app = makeApp(() => Promise.resolve(new Response('', { status: 304 })))
      try {
        // Force selection failure by asking for an unknown component.
        await expect(getZuluJRE(app as any, 'java-runtime-unknown' as any))
          .rejects.toThrow(/No zulu jre found.*tried/)
      } finally {
        app.dispose()
      }
    })
  })

  describe('setupZuluCache', () => {
    test('does not persist an unhealthy remote response over the cache', async () => {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ broken: true }), { status: 200 }))
      const app = makeApp(fetchImpl)
      try {
        await setupZuluCache(app as any)
        // Cache file must still resolve to a healthy index.
        const jre = await getZuluJRE(app as any, 'java-runtime-alpha')
        expect(jre).toBeDefined()
      } finally {
        app.dispose()
      }
    })

    test('persists a healthy remote response', async () => {
      const remote = { ...bundledIndex, modified: 'updated-stamp' }
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify(remote), { status: 200 }))
      const app = makeApp(fetchImpl)
      try {
        await setupZuluCache(app as any)
        const onDisk = require(join(app.appDataPath, 'zulu.json'))
        expect(onDisk.modified).toBe('updated-stamp')
      } finally {
        app.dispose()
      }
    })
  })
})

/**
 * Packaged-app boot + network smoke (release-gated).
 *
 * Runs ONLY against the genuine `electron-builder --dir` artifact (a packed
 * `app.asar`), and ONLY for the automated "Prepare Release" PR — it is far too
 * heavy for basic per-PR validation (see `.github/workflows/e2e.yml`).
 *
 * It guards two things a flat-`dist/` boot can never catch:
 *
 *   1. The packaged renderer boots without a production-only crash — same
 *      contract as `specs/ci/00-smoke-boot.spec.ts`, but against the asar.
 *   2. The launcher's bundled `undici` can actually make an HTTP request from
 *      inside `app.asar`. This is the exact path that crashed on macOS in
 *      #1576 (`ENOENT, llhttp-wasm.wasm not found in …/app.asar`) on the first
 *      download. We force it deterministically and network-free by dispatching
 *      one request at a loopback server via the main-process `__xmclE2EProbeHttp`
 *      hook (installed in xmcl-electron-app/main/index.ts under XMCL_E2E).
 *
 * Both assertions are driven from the main process (`app.evaluate`) because
 * Playwright's CDP page-target attachment is unreliable against the launcher's
 * custom-protocol window under xvfb — see the note in specs/ci/00-smoke-boot.
 */
import { createServer, Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { ElectronApplication } from '@playwright/test'
import { test, expect } from '../../fixtures/packaged'

const BOOT_BREAKERS = [
  'is not defined',
  'init_runtime_dom_esm_bundler',
  'Failed to fetch dynamically imported module',
]

/** Wait until a renderer window whose URL matches /index.html finishes loading. */
async function waitForRendererBoot(app: ElectronApplication, timeoutMs: number) {
  return app.evaluate(async ({ BrowserWindow }, timeout) => {
    const deadline = Date.now() + timeout
    const observed = new Set<string>()
    const pattern = /\/(index|setup)\.html(\?|#|$)/
    while (Date.now() < deadline) {
      for (const w of BrowserWindow.getAllWindows() as any[]) {
        if (w.isDestroyed()) continue
        const url = w.webContents.getURL()
        if (url) observed.add(url)
        if (pattern.test(url) && !w.webContents.isLoading()) {
          const probe = await w.webContents.executeJavaScript(
            `({ url: location.href, bodyChildren: document.body ? document.body.children.length : -1, bootErrors: (window).__bootErrors || [] })`,
          )
          return { ok: true, ...probe, observedUrls: Array.from(observed) }
        }
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    return { ok: false, observedUrls: Array.from(observed) }
  }, timeoutMs)
}

test.describe('Packaged app (release-gated)', () => {
  test('boots from app.asar and its bundled undici can make an HTTP request', async ({ packaged }) => {
    // 1. The packaged renderer boots without a production-only crash.
    const boot = await waitForRendererBoot(packaged.app, 180_000)
    expect(boot.ok, `Packaged renderer never booted. Observed: ${JSON.stringify(boot.observedUrls)}`).toBe(true)
    expect(boot.url, 'Renderer URL').toMatch(/\/(index|setup)\.html/)
    expect(boot.bodyChildren ?? -1, 'Renderer body should be populated').toBeGreaterThan(0)
    const fatal = (boot.bootErrors ?? []).filter((line: string) =>
      BOOT_BREAKERS.some((needle) => line.toLowerCase().includes(needle.toLowerCase())),
    )
    expect(fatal, `Renderer reported a boot-level failure:\n${(boot.bootErrors ?? []).join('\n')}`).toEqual([])

    // 2. The bundled undici (llhttp-wasm) resolves and works from inside the
    //    asar. Spin up a loopback server so this stays deterministic and
    //    network-free, then dispatch one request through the launcher's own
    //    undici via the main-process probe.
    const server: Server = await new Promise((res) => {
      const s = createServer((_req, reply) => {
        reply.writeHead(200, { 'content-type': 'text/plain' })
        reply.end('xmcl-e2e-ok')
      })
      s.listen(0, '127.0.0.1', () => res(s))
    })
    try {
      const port = (server.address() as AddressInfo).port
      const url = `http://127.0.0.1:${port}/`
      const result = await packaged.app.evaluate(async (_electron, target) => {
        const probe = (globalThis as any).__xmclE2EProbeHttp
        if (typeof probe !== 'function') {
          throw new Error('__xmclE2EProbeHttp hook missing — is XMCL_E2E set for the packaged app?')
        }
        // Throws `ENOENT … llhttp-wasm.wasm` on the broken (pre-#1578) build.
        return probe(target)
      }, url)

      expect(result.status, 'bundled undici request status').toBe(200)
      expect(result.bodyLength, 'bundled undici response body length').toBe('xmcl-e2e-ok'.length)
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })
})

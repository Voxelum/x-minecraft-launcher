/**
 * dev-wails.ts — launch the Go/Wails backend pointed at a running
 * Vite dev server. Mirrors `dev:main` (which only starts Electron
 * and assumes `dev:renderer` is already running).
 *
 * Usage:
 *   pnpm dev:renderer   # in one terminal — runs vite (port 3000)
 *   pnpm dev:wails      # in another     — runs the Go/Wails binary
 *
 * Wails v3 reverse-proxies every renderer asset request to
 * `FRONTEND_DEVSERVER_URL` while keeping `/wails/runtime`,
 * `/wails/runtime.js`, and the Bridge service routes on the Go side.
 *
 * We probe `127.0.0.1` instead of `localhost` because Wails' built-in
 * dev proxy hard-codes IPv4 for any localhost target (see
 * assetserver/build_dev.go in the Wails sources). Vite must therefore
 * be reachable on IPv4 — start it with `--host 127.0.0.1` if your
 * default `vite` binds to IPv6 only.
 *
 * Optional env:
 *   XMCL_VITE_PORT (default 3000 — pinned in xmcl-keystone-ui/vite.config.ts)
 *   XMCL_VITE_HOST (default localhost — used only for the URL Wails sees)
 */

import { spawn } from 'child_process'
import { setTimeout as sleep } from 'timers/promises'

const VITE_PORT = process.env.XMCL_VITE_PORT || '3000'
const VITE_HOST = process.env.XMCL_VITE_HOST || 'localhost'
const VITE_ORIGIN = `http://${VITE_HOST}:${VITE_PORT}`
const VITE_PROBE = VITE_ORIGIN
const WAIT_MAX_MS = 30_000

async function waitForVite(): Promise<void> {
  const deadline = Date.now() + WAIT_MAX_MS
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 1500)
      try {
        const res = await fetch(VITE_PROBE, { method: 'GET', signal: ctrl.signal })
        if (res.ok || res.status === 404) return
      } finally {
        clearTimeout(t)
      }
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
  console.error(`[dev:wails] Vite did not respond at ${VITE_PROBE} within ${WAIT_MAX_MS}ms.`)
  console.error('[dev:wails] Start the renderer first: pnpm dev:renderer')
  process.exit(1)
}

async function main() {
  console.log(`[dev:wails] waiting for Vite at ${VITE_PROBE}…`)
  await waitForVite()
  console.log(`[dev:wails] Vite is up; launching Wails (FRONTEND_DEVSERVER_URL=${VITE_ORIGIN})`)

  const wails = spawn('go -C xmcl-wails-app run .', {
    stdio: 'inherit',
    env: { ...process.env, FRONTEND_DEVSERVER_URL: VITE_ORIGIN },
    shell: true,
  })
  wails.on('exit', (code) => process.exit(code ?? 0))

  const stop = () => { try { wails.kill('SIGINT') } catch { /* ignore */ } }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((err) => {
  console.error('[dev:wails] failed:', err)
  process.exit(1)
})

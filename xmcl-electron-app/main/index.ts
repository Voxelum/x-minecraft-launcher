// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import { app } from 'electron'
// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'

// Disable sandbox for AppImage to avoid chrome-sandbox permission issues
// AppImage mounts to /tmp which cannot have proper setuid permissions
if (process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox')
}

// E2E-only network probe. Dispatches exactly one HTTP request through the SAME
// bundled `undici` the launcher uses for every download, forcing its
// llhttp-wasm parser to initialise. The parser is read at runtime from the
// on-disk `.wasm` the native esbuild plugin extracts next to the bundle, so
// this exercises the packaged-`app.asar` file resolution that regressed on
// macOS in #1576 (PR #1578). The packaged-boot e2e calls this after boot and
// asserts it resolves — a plain boot never touches the parser, so it can't
// catch the regression on its own. Inert unless XMCL_E2E is set.
if (process.env.XMCL_E2E) {
  Object.defineProperty(globalThis, '__xmclE2EProbeHttp', {
    configurable: true,
    value: async (url: string) => {
      const { request } = await import('undici')
      const res = await request(url, { method: 'GET' })
      const body = await res.body.text()
      return { status: res.statusCode, bodyLength: body.length }
    },
  })
}

new ElectronLauncherApp().start()

/**
 * Packaged-app fixture.
 *
 * Unlike `fixtures/launcher.ts` — which launches the *flat*
 * `xmcl-electron-app/dist/index.js` directory with the workspace Electron
 * binary — this fixture launches the **real artifact** produced by
 * `electron-builder --dir` (i.e. `pnpm --prefix xmcl-electron-app build`),
 * where every bundle lives inside a packed `app.asar`.
 *
 * Why it exists: bugs like #1576 (the `llhttp-wasm.wasm not found in
 * …/app.asar` crash) only reproduce against the packed layout — inside the
 * asar a consumer's `__dirname` is NOT the output root, so files the esbuild
 * native plugin extracts next to the bundle resolve differently. The flat
 * `dist/` tree the normal e2e drives can never surface it. This fixture closes
 * that gap by booting the genuine packaged binary.
 *
 * It is intentionally heavier (requires a full pack) so it runs only for the
 * automated "Prepare Release" PR — see `.github/workflows/e2e.yml`.
 */
import { _electron, ElectronApplication, test as base } from '@playwright/test'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const OUTPUT_ROOT = resolve(REPO_ROOT, 'xmcl-electron-app/build/output')

/**
 * Locate the packaged executable `electron-builder --dir` emitted for the
 * current runner. electron-builder names the per-arch output dirs; on macOS it
 * emits `mac` (x64) and/or `mac-arm64`, so we prefer the one matching the
 * runner arch and fall back to whatever exists.
 */
function findPackagedBinary(): string {
  const productName = 'XMCL'
  if (process.platform === 'win32') {
    return join(OUTPUT_ROOT, 'win-unpacked', `${productName}.exe`)
  }
  if (process.platform === 'darwin') {
    const archDirs = process.arch === 'arm64'
      ? ['mac-arm64', 'mac', 'mac-universal']
      : ['mac', 'mac-arm64', 'mac-universal']
    for (const d of archDirs) {
      const p = join(OUTPUT_ROOT, d, `${productName}.app`, 'Contents', 'MacOS', productName)
      if (existsSync(p)) return p
    }
    return join(OUTPUT_ROOT, archDirs[0], `${productName}.app`, 'Contents', 'MacOS', productName)
  }
  return join(OUTPUT_ROOT, 'linux-unpacked', 'xmcl')
}

export interface PackagedFixture {
  /** Underlying Playwright Electron application (the packaged binary). */
  app: ElectronApplication
  /** Per-test isolated Electron userData / app data path. */
  appDataPath: string
  /** Per-test isolated game data root. */
  gameDataPath: string
}

interface DiagnosticWindow {
  id: number
  isDestroyed(): boolean
  isVisible(): boolean
  webContents: {
    getURL(): string
    isLoading(): boolean
  }
}

async function captureMainState(app: ElectronApplication) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      app.evaluate(({ app, BrowserWindow }) => ({
        pid: process.pid,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        executablePath: process.execPath,
        appPath: app.getAppPath(),
        version: app.getVersion(),
        ready: app.isReady(),
        singleInstanceLock: app.hasSingleInstanceLock(),
        entryProbeInstalled: '__xmclE2EProbeHttp' in globalThis,
        activeResources: process.getActiveResourcesInfo(),
        windows: BrowserWindow.getAllWindows().filter((window: DiagnosticWindow) => !window.isDestroyed()).map((window: DiagnosticWindow) => ({
          id: window.id,
          destroyed: window.isDestroyed(),
          url: window.webContents.getURL(),
          loading: window.webContents.isLoading(),
          visible: window.isVisible(),
        })),
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Main-process diagnostic probe timed out after 5 seconds')), 5_000)
      }),
    ])
  } catch (error) {
    return { diagnosticError: String(error) }
  } finally {
    clearTimeout(timer)
  }
}

export const test = base.extend<{ packaged: PackagedFixture }>({
  packaged: async ({}, use, testInfo) => {
    const bin = findPackagedBinary()
    if (!existsSync(bin)) {
      throw new Error(
        `Packaged binary not found at ${bin}. Run \`pnpm --prefix xmcl-electron-app build\` ` +
        '(electron-builder --dir) before the packaged-boot e2e.',
      )
    }

    const tempRoot = await mkdtemp(join(tmpdir(), 'xmcl-e2e-pkg-'))
    const appDataPath = join(tempRoot, 'appData')
    const gameDataPath = join(tempRoot, 'gameData')
    const xmclDir = join(appDataPath, 'xmcl')
    let app: ElectronApplication | undefined
    let failure: string | undefined
    let stdio = ''
    const cleanupErrors: unknown[] = []
    const record = (chunk: Buffer, stream: NodeJS.WriteStream) => {
      const message = `[electron] ${chunk}`
      stdio = (stdio + message).slice(-1_048_576)
      stream.write(message)
    }
    try {
      await mkdir(xmclDir, { recursive: true })
      await mkdir(gameDataPath, { recursive: true })
      // Skip the first-launch wizard: point the launcher root at our temp dir.
      await writeFile(join(xmclDir, 'root'), gameDataPath)
      app = await _electron.launch({
        executablePath: bin,
        // No `args`: the packaged binary bakes the app.asar entry in.
        env: {
          ...process.env,
          XMCL_E2E: '1',
          XMCL_E2E_APP_DATA: appDataPath,
          XMCL_E2E_GAME_DATA: gameDataPath,
          XMCL_E2E_NO_LAUNCH: '1',
          XMCL_E2E_LOCALE: 'en',
          NODE_ENV: 'production',
          FORCE_COLOR: '0',
        },
        timeout: 120_000,
        recordVideo: { dir: testInfo.outputDir },
      })

      const proc = app.process()
      proc.stdout?.on('data', (b: Buffer) => record(b, process.stdout))
      proc.stderr?.on('data', (b: Buffer) => record(b, process.stderr))
      await use({ app, appDataPath, gameDataPath })
    } catch (error) {
      failure = String(error)
      throw error
    } finally {
      const logRoot = join(xmclDir, 'logs')
      const steps: Array<[string, () => Promise<unknown>]> = [
        ['capture main state', async () => {
          const path = testInfo.outputPath('packaged-main-state.json')
          await writeFile(path, JSON.stringify({
            executablePath: bin,
            appDataPath,
            gameDataPath,
            failure,
            logDirectoryPresent: existsSync(logRoot),
            state: app ? await captureMainState(app) : { diagnosticError: 'Electron launch did not complete' },
          }, null, 2))
          await testInfo.attach('packaged-main-state', {
            contentType: 'application/json',
            path,
          })
        }],
        ['close Electron', async () => { await app?.close() }],
        ['preserve launcher logs', async () => {
          if (existsSync(logRoot)) {
            await cp(logRoot, testInfo.outputPath('launcher-logs'), {
              recursive: true,
              filter: (source) => source === logRoot || extname(source) === '.log',
            })
          }
        }],
        ['preserve stdio', async () => {
          const path = testInfo.outputPath('packaged-stdio.log')
          await writeFile(path, stdio)
          await testInfo.attach('packaged-stdio', {
            contentType: 'text/plain',
            path,
          })
        }],
        ['remove isolated profile', async () => {
          await rm(tempRoot, { recursive: true, force: true })
        }],
      ]
      for (const [name, run] of steps) {
        try {
          await run()
        } catch (error) {
          console.error(`Packaged fixture failed to ${name}:`, error)
          cleanupErrors.push(error)
        }
      }
    }
    if (cleanupErrors.length && testInfo.status === testInfo.expectedStatus) {
      throw new AggregateError(cleanupErrors, 'Packaged fixture cleanup failed')
    }
  },
})

export { expect } from '@playwright/test'

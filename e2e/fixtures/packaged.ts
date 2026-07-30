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
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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
  const productName = 'X Minecraft Launcher'
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
    await mkdir(appDataPath, { recursive: true })
    await mkdir(gameDataPath, { recursive: true })
    // Skip the first-launch wizard: point the launcher root at our temp dir.
    const xmclDir = join(appDataPath, 'xmcl')
    await mkdir(xmclDir, { recursive: true })
    await writeFile(join(xmclDir, 'root'), gameDataPath)

    const app = await _electron.launch({
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
    proc.stdout?.on('data', (b: Buffer) => process.stdout.write(`[electron] ${b}`))
    proc.stderr?.on('data', (b: Buffer) => process.stderr.write(`[electron] ${b}`))

    try {
      await use({ app, appDataPath, gameDataPath })
    } finally {
      await app.close().catch(() => { /* already exited */ })
    }
  },
})

export { expect } from '@playwright/test'

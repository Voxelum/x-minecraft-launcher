/** Real Electron harness for backup journeys. Only native file-picker results are stubbed. */
import { _electron, expect, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushJourneyManifest, newJourneyManifest } from './manifest'
import { shoot } from './shoot'
import { AppShell } from './pom/AppShell'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const INSTANCE = 'backup-fixture'
export const ORIGINAL = Buffer.from('backup fixture\u0000config\n')
export const CHANGED = Buffer.from('live conflict\u0000config\n')
export class BackupHarness {
  app!: ElectronApplication
  main!: Page
  readonly appData: string
  readonly data: string
  readonly profile: string
  readonly instance: string
  private running = false
  readonly logs: string[] = []
  readonly manifest: ReturnType<typeof newJourneyManifest>
  constructor(readonly root: string, journey: string) {
    this.manifest = newJourneyManifest({ journey, locale: 'en', file: '06-backup-restore.spec.ts' })
    this.appData = join(root, 'appData')
    this.profile = join(this.appData, 'xmcl')
    this.data = join(root, 'gameData')
    this.instance = join(this.data, 'instances', INSTANCE)
  }

  async put(path: string, value: string | Buffer) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, value)
  }

  async seed() {
    await this.put(join(this.profile, 'root'), this.data)
    await this.put(join(this.profile, 'setting.json'), JSON.stringify({ locale: 'en', theme: 'dark', maxSockets: 37 }))
    await this.put(join(this.profile, 'collections.json'), JSON.stringify({ schemaVersion: 1, collections: [{ id: 'backup-fixture', name: 'Original collection', createdAt: 1, updatedAt: 1, mods: [], resourcepacks: [], shaderpacks: [] }] }))
    await this.put(join(this.profile, 'theme.json'), JSON.stringify({ settings: { customCssEnabled: false } }))
    await this.put(join(this.profile, 'theme.css'), '/* backup fixture */\n')
    await this.put(join(this.profile, 'theme-media', 'fixture.bin'), ORIGINAL)
    await this.put(join(this.instance, 'instance.json'), JSON.stringify({ name: INSTANCE, edition: 'java', runtime: { minecraft: '1.20.4' }, version: '', creationDate: 1, lastAccessDate: 1 }))
    await this.put(join(this.instance, 'config', 'fixture.bin'), ORIGINAL)
    await this.put(join(this.instance, 'saves', 'world', 'level.dat'), ORIGINAL)
    // No Minecraft version, download or game launch is needed for this fixture.
  }

  async start() {
    const binary = process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : process.platform === 'win32' ? 'electron.exe' : 'electron'
    this.app = await _electron.launch({
      executablePath: join(repo, 'xmcl-electron-app/node_modules/electron/dist', binary),
      args: [join(repo, 'xmcl-electron-app/dist/index.js')], cwd: join(repo, 'xmcl-electron-app/dist'),
      env: { ...process.env, XMCL_E2E: '1', XMCL_E2E_NO_LAUNCH: '1', XMCL_E2E_APP_DATA: this.appData, XMCL_E2E_GAME_DATA: this.data, XMCL_E2E_LOCALE: 'en', NODE_ENV: 'production' },
    })
    this.running = true
    this.app.process().stdout?.on('data', b => this.logs.push(String(b)))
    this.app.process().stderr?.on('data', b => this.logs.push(String(b)))
    await expect.poll(() => this.app.windows().find(p => /\/(index|setup)\.html(?:[?#]|$)/.test(p.url())) !== undefined, { timeout: 90_000 }).toBe(true)
    this.main = this.app.windows().find(p => /\/index\.html(?:[?#]|$)/.test(p.url()))!
    await new AppShell(this.main).waitReady()
    await this.app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'))?.setSize(1200, 720) })
    this.main.on('pageerror', e => this.logs.push(`PAGEERROR ${e.stack}`))
  }

  async stop() { if (this.running) { await this.app.close(); this.running = false } }
  async restart() { await this.stop(); await this.start() }
  async settings() { await new AppShell(this.main).goto('/setting'); await expect(this.main.getByTestId('create-backup-btn')).toBeVisible() }
  async picker(path: string) {
    // Main-process Electron dialog only. Renderer/preload/IPC/BackupService remain real.
    await this.app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
    }, path)
  }
  async selectArchive(path: string) {
    await this.picker(path)
    await this.main.getByTestId('restore-backup-btn').click()
    await this.main.getByTestId('backup-restore-select-file').click()
    await expect(this.main.getByTestId('backup-restore-instance-row')).toHaveCount(1)
  }
  async restore(strategy: 'rename' | 'skip' | 'overwrite', success = true) {
    const radio = this.main.getByTestId(`backup-restore-conflict-${strategy}`).locator('input[type="radio"]')
    await radio.check()
    await expect(radio).toBeChecked()
    await this.main.getByTestId('backup-restore-submit').click()
    await expect(this.main.getByTestId(success ? 'backup-restore-result' : 'backup-restore-error')).toBeVisible({ timeout: 60_000 })
  }
  async shot(step: string, caption: string) { await shoot(this, step, { caption }) }
  async hash(path: string) { return createHash('sha256').update(await readFile(path)).digest('hex') }
  async archives() { return (await readdir(join(this.root, 'automatic')).catch(() => [])).filter(n => /^xmcl-auto-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}\.xmclbackup$/.test(n)).sort() }
}

export const test = base.extend<{ backup: BackupHarness }>({
  backup: async ({}, use, info) => {
    const root = await realpath(await mkdtemp(join(await realpath(tmpdir()), 'xmcl-backup-e2e-')))
    const h = new BackupHarness(root, info.title)
    await h.seed()
    try { await h.start(); await use(h) } finally {
      await h.stop()
      await flushJourneyManifest(h.manifest)
      await info.attach('backup-main.log', { body: h.logs.join(''), contentType: 'text/plain' })
      await info.attach('isolated-profile.json', { body: JSON.stringify({ root, preserved: info.status !== info.expectedStatus }), contentType: 'application/json' })
      if (info.status === info.expectedStatus) await rm(root, { recursive: true })
      else console.error(`Backup E2E failed: original evidence preserved at ${root}`)
    }
  },
})
export { expect }

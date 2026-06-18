import { CustomCssEntry, CustomCssService as ICustomCssService, CustomCssServiceKey, CustomCssState } from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { readFile, stat, writeFile, unlink, rename, readdir } from 'fs/promises'
import { ensureDir, ensureFile, readJSON, writeJson } from 'fs-extra'
import { basename, join } from 'path'
import { randomUUID } from 'crypto'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

const MAX_CSS_SIZE = 1024 * 1024 // 1 MB

@ExposeServiceKey(CustomCssServiceKey)
export class CustomCssService extends AbstractService implements ICustomCssService {
  private state: CustomCssState = { globalEnabled: false, entries: [] }

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => this.init())
  }

  private async init() {
    const filePath = this.getAppDataPath('custom-css.json')
    const cssDir = this.getAppDataPath('custom-css')
    await ensureDir(cssDir)

    try {
      this.state = await readJSON(filePath)
      if (!Array.isArray(this.state.entries)) this.state.entries = []
      if (typeof this.state.globalEnabled !== 'boolean') this.state.globalEnabled = false
    } catch {
      this.state = { globalEnabled: false, entries: [] }
    }

    await this.syncWithDisk()
  }

  async syncWithDisk(): Promise<void> {
    const cssDir = this.getAppDataPath('custom-css')
    const files = await readdir(cssDir).catch(() => [])
    const cssFiles = files.filter(f => f.endsWith('.css'))

    const newEntries: CustomCssEntry[] = []
    const scannedIds = new Set<string>()

    for (const file of cssFiles) {
      const name = basename(file, '.css')
      const cssPath = join(cssDir, file)
      const css = await readFile(cssPath, 'utf-8').catch(() => '')

      let entry = this.state.entries.find(e => e.name === name)
      if (entry) {
        entry.css = css
        scannedIds.add(entry.id)
      } else {
        entry = {
          id: randomUUID(),
          name,
          css,
          enabled: true,
          source: 'file',
          createdAt: Date.now(),
        }
        newEntries.push(entry)
        scannedIds.add(entry.id)
      }
    }

    // Keep only entries whose files actually exist on disk
    this.state.entries = [
      ...this.state.entries.filter(e => scannedIds.has(e.id)),
      ...newEntries
    ]

    await this.saveMetadataOnly()
  }

  private async saveMetadataOnly() {
    const filePath = this.getAppDataPath('custom-css.json')
    await ensureFile(filePath)
    await writeJson(filePath, this.state, { spaces: 2 })
    this.emit('custom-css-state-changed', this.state)
  }

  private async save() {
    // Write all entries to disk
    const cssDir = this.getAppDataPath('custom-css')
    await ensureDir(cssDir)

    for (const entry of this.state.entries) {
      const cssPath = join(cssDir, `${entry.name}.css`)
      await writeFile(cssPath, entry.css, 'utf-8')
    }

    await this.saveMetadataOnly()
  }
  // Я ХОЧУ ЧААААЙ З ПЕЧЕНЮШКАМИ
  async getCustomCssState(): Promise<CustomCssState> {
    return { ...this.state, entries: [...this.state.entries] }
  }

  async addCustomCssFromText(name: string, css: string): Promise<CustomCssEntry> {
    if (css.length > MAX_CSS_SIZE) {
      throw new Error('CSS content exceeds maximum size of 1 MB')
    }
    const safeName = (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_')
    const entry: CustomCssEntry = {
      id: randomUUID(),
      name: safeName,
      css,
      enabled: true,
      source: 'manual',
      createdAt: Date.now(),
    }
    this.state.entries.push(entry)

    // Write directly to file
    const cssPath = join(this.getAppDataPath('custom-css'), `${safeName}.css`)
    await ensureDir(this.getAppDataPath('custom-css'))
    await writeFile(cssPath, css, 'utf-8')

    await this.saveMetadataOnly()
    return entry
  }

  async addCustomCssFromFile(filePath: string): Promise<CustomCssEntry> {
    const fileStat = await stat(filePath)
    if (fileStat.size > MAX_CSS_SIZE) {
      throw new Error('CSS file exceeds maximum size of 1 MB')
    }
    const css = await readFile(filePath, 'utf-8')
    const name = basename(filePath, '.css').replace(/[\\/:*?"<>|]/g, '_')
    const entry: CustomCssEntry = {
      id: randomUUID(),
      name,
      css,
      enabled: true,
      source: 'file',
      createdAt: Date.now(),
    }
    this.state.entries.push(entry)

    // Write to folder
    const cssPath = join(this.getAppDataPath('custom-css'), `${name}.css`)
    await ensureDir(this.getAppDataPath('custom-css'))
    await writeFile(cssPath, css, 'utf-8')

    await this.saveMetadataOnly()
    return entry
  }

  async addCustomCssFromZip(filePath: string): Promise<CustomCssEntry[]> {
    const zipFile = await open(filePath)
    const entries = await readAllEntries(zipFile)
    const newEntries: CustomCssEntry[] = []
    const cssDir = this.getAppDataPath('custom-css')
    await ensureDir(cssDir)

    for (const e of entries) {
      if (!e.fileName.endsWith('.css') || e.fileName.startsWith('__MACOSX')) continue
      if (e.uncompressedSize > MAX_CSS_SIZE) continue

      const readable = await openEntryReadStream(zipFile, e)
      const buffers: Buffer[] = []
      for await (const chunk of readable) {
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const css = Buffer.concat(buffers).toString('utf-8')
      const name = basename(e.fileName, '.css').replace(/[\\/:*?"<>|]/g, '_')

      const entry: CustomCssEntry = {
        id: randomUUID(),
        name,
        css,
        enabled: true,
        source: 'zip',
        createdAt: Date.now(),
      }
      newEntries.push(entry)

      const cssPath = join(cssDir, `${name}.css`)
      await writeFile(cssPath, css, 'utf-8')
    }

    this.state.entries.push(...newEntries)
    await this.saveMetadataOnly()
    return newEntries
  }

  async updateCustomCssEntry(id: string, patch: Partial<Pick<CustomCssEntry, 'name' | 'css' | 'enabled'>>): Promise<CustomCssEntry> {
    const entry = this.state.entries.find(e => e.id === id)
    if (!entry) throw new Error(`Custom CSS entry not found: ${id}`)

    const cssDir = this.getAppDataPath('custom-css')
    const oldName = entry.name

    if (patch.name !== undefined) {
      const safeName = patch.name.replace(/[\\/:*?"<>|]/g, '_')
      if (safeName !== oldName) {
        entry.name = safeName
        // Rename file on disk if it exists
        const oldPath = join(cssDir, `${oldName}.css`)
        const newPath = join(cssDir, `${safeName}.css`)
        await rename(oldPath, newPath).catch(() => {})
      }
    }
    if (patch.css !== undefined) {
      if (patch.css.length > MAX_CSS_SIZE) {
        throw new Error('CSS content exceeds maximum size of 1 MB')
      }
      entry.css = patch.css
      // Write new content
      const cssPath = join(cssDir, `${entry.name}.css`)
      await writeFile(cssPath, patch.css, 'utf-8')
    }
    if (patch.enabled !== undefined) {
      entry.enabled = patch.enabled
    }

    await this.saveMetadataOnly()
    return { ...entry }
  }

  async removeCustomCssEntry(id: string): Promise<void> {
    const index = this.state.entries.findIndex(e => e.id === id)
    if (index === -1) throw new Error(`Custom CSS entry not found: ${id}`)

    const entry = this.state.entries[index]
    const cssPath = join(this.getAppDataPath('custom-css'), `${entry.name}.css`)
    await unlink(cssPath).catch(() => {})

    this.state.entries.splice(index, 1)
    await this.saveMetadataOnly()
  }

  async exportCustomCssToFile(id: string, filePath: string): Promise<void> {
    const entry = this.state.entries.find(e => e.id === id)
    if (!entry) throw new Error(`Custom CSS entry not found: ${id}`)
    await writeFile(filePath, entry.css, 'utf-8')
  }

  async setGlobalCustomCssEnabled(enabled: boolean): Promise<void> {
    this.state.globalEnabled = enabled
    await this.saveMetadataOnly()
  }

  async importCustomCssState(state: CustomCssState): Promise<void> {
    if (!state) return
    this.state.globalEnabled = typeof state.globalEnabled === 'boolean' ? state.globalEnabled : false
    this.state.entries = Array.isArray(state.entries) ? state.entries : []
    await this.save() // This writes all entries to disk
  }
}

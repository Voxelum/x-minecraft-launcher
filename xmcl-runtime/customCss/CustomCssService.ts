import { CustomCssEntry, CustomCssService as ICustomCssService, CustomCssServiceKey, CustomCssState } from '@xmcl/runtime-api'
import { open, openEntryReadStream, readAllEntries } from '@xmcl/unzip'
import { readFile, stat, writeFile } from 'fs/promises'
import { ensureFile, readJSON, writeJson } from 'fs-extra'
import { basename } from 'path'
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
    try {
      this.state = await readJSON(filePath)
      if (!Array.isArray(this.state.entries)) this.state.entries = []
      if (typeof this.state.globalEnabled !== 'boolean') this.state.globalEnabled = false
    } catch {
      this.state = { globalEnabled: false, entries: [] }
    }
  }

  private async save() {
    const filePath = this.getAppDataPath('custom-css.json')
    await ensureFile(filePath)
    await writeJson(filePath, this.state, { spaces: 2 })
  }

  async getCustomCssState(): Promise<CustomCssState> {
    return { ...this.state, entries: [...this.state.entries] }
  }

  async addCustomCssFromText(name: string, css: string): Promise<CustomCssEntry> {
    if (css.length > MAX_CSS_SIZE) {
      throw new Error('CSS content exceeds maximum size of 1 MB')
    }
    const entry: CustomCssEntry = {
      id: randomUUID(),
      name: name || 'Untitled',
      css,
      enabled: true,
      source: 'manual',
      createdAt: Date.now(),
    }
    this.state.entries.push(entry)
    await this.save()
    return entry
  }

  async addCustomCssFromFile(filePath: string): Promise<CustomCssEntry> {
    const fileStat = await stat(filePath)
    if (fileStat.size > MAX_CSS_SIZE) {
      throw new Error('CSS file exceeds maximum size of 1 MB')
    }
    const css = await readFile(filePath, 'utf-8')
    const name = basename(filePath, '.css')
    const entry: CustomCssEntry = {
      id: randomUUID(),
      name,
      css,
      enabled: true,
      source: 'file',
      createdAt: Date.now(),
    }
    this.state.entries.push(entry)
    await this.save()
    return entry
  }

  async addCustomCssFromZip(filePath: string): Promise<CustomCssEntry[]> {
    const zipFile = await open(filePath)
    const entries = await readAllEntries(zipFile)
    const newEntries: CustomCssEntry[] = []

    for (const e of entries) {
      if (!e.fileName.endsWith('.css') || e.fileName.startsWith('__MACOSX')) continue
      if (e.uncompressedSize > MAX_CSS_SIZE) continue

      const readable = await openEntryReadStream(zipFile, e)
      const buffers: Buffer[] = []
      for await (const chunk of readable) {
        buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const css = Buffer.concat(buffers).toString('utf-8')
      const name = basename(e.fileName, '.css')

      const entry: CustomCssEntry = {
        id: randomUUID(),
        name,
        css,
        enabled: true,
        source: 'zip',
        createdAt: Date.now(),
      }
      newEntries.push(entry)
    }

    this.state.entries.push(...newEntries)
    await this.save()
    return newEntries
  }

  async updateCustomCssEntry(id: string, patch: Partial<Pick<CustomCssEntry, 'name' | 'css' | 'enabled'>>): Promise<CustomCssEntry> {
    const entry = this.state.entries.find(e => e.id === id)
    if (!entry) throw new Error(`Custom CSS entry not found: ${id}`)
    if (patch.name !== undefined) entry.name = patch.name
    if (patch.css !== undefined) {
      if (patch.css.length > MAX_CSS_SIZE) {
        throw new Error('CSS content exceeds maximum size of 1 MB')
      }
      entry.css = patch.css
    }
    if (patch.enabled !== undefined) entry.enabled = patch.enabled
    await this.save()
    return { ...entry }
  }

  async removeCustomCssEntry(id: string): Promise<void> {
    const index = this.state.entries.findIndex(e => e.id === id)
    if (index === -1) throw new Error(`Custom CSS entry not found: ${id}`)
    this.state.entries.splice(index, 1)
    await this.save()
  }

  async exportCustomCssToFile(id: string, filePath: string): Promise<void> {
    const entry = this.state.entries.find(e => e.id === id)
    if (!entry) throw new Error(`Custom CSS entry not found: ${id}`)
    await writeFile(filePath, entry.css, 'utf-8')
  }

  async setGlobalCustomCssEnabled(enabled: boolean): Promise<void> {
    this.state.globalEnabled = enabled
    await this.save()
  }
}

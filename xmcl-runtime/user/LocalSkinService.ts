import { AddLocalSkinOptions, LocalSkin, LocalSkinService as ILocalSkinService, LocalSkinServiceKey, LocalSkinState, UpdateLocalSkinOptions } from '@xmcl/runtime-api'
import { writeFile as writeAtomically } from 'atomically'
import { randomUUID } from 'crypto'
import { copyFile, ensureDir, readFile, remove } from 'fs-extra'
import { isAbsolute, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'

const LOCAL_SKIN_LOCK = 'local-skin-service'

@ExposeServiceKey(LocalSkinServiceKey)
export class LocalSkinService extends AbstractService implements ILocalSkinService {
  private readonly closetPath: string
  private readonly statePath: string
  private state: LocalSkinState = { skins: [], equippedSkinIds: {} }

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, async () => {
      await ensureDir(this.closetPath)
      this.state = await this.loadState()
    })
    this.closetPath = this.getAppDataPath('closet')
    this.statePath = join(this.closetPath, 'index.json')
  }

  private async loadState(): Promise<LocalSkinState> {
    try {
      const parsed = JSON.parse(await readFile(this.statePath, 'utf-8')) as Partial<LocalSkinState>
      return {
        skins: Array.isArray(parsed.skins) ? parsed.skins : [],
        equippedSkinIds: parsed.equippedSkinIds && typeof parsed.equippedSkinIds === 'object' ? parsed.equippedSkinIds : {},
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.warn(`Fail to load ${this.statePath}`)
        this.warn(e as Error)
      }
      return { skins: [], equippedSkinIds: {} }
    }
  }

  private async saveState() {
    await writeAtomically(this.statePath, JSON.stringify(this.state, null, 2))
  }

  private getLocalSource(source: string): string | undefined {
    if (source.startsWith('file:')) {
      return fileURLToPath(source)
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const url = new URL(source)
      if (url.host === 'launcher' && url.pathname === '/media') {
        return url.searchParams.get('path') || undefined
      }
      return undefined
    }
    return source
  }

  private getMediaUrl(path: string) {
    const url = new URL('http://launcher/media')
    url.searchParams.set('path', path)
    return url.toString()
  }

  async getState(): Promise<LocalSkinState> {
    await this.initialize()
    return structuredClone(this.state)
  }

  async addSkin(options: AddLocalSkinOptions): Promise<LocalSkin> {
    await this.initialize()
    return this.mutex.of(LOCAL_SKIN_LOCK).runExclusive(async () => {
      const id = randomUUID()
      const localSource = this.getLocalSource(options.source)
      let url = options.source
      if (localSource) {
        const { fileTypeFromFile } = await import('file-type')
        const fileType = await fileTypeFromFile(localSource)
        if (fileType?.mime !== 'image/png') {
          throw new Error('The local skin must be a PNG image')
        }
        const target = join(this.closetPath, `${id}.png`)
        await copyFile(localSource, target)
        url = this.getMediaUrl(target)
      }
      const skin: LocalSkin = {
        id,
        name: options.name.trim() || 'Custom Skin',
        url,
        slim: options.slim,
        dateAdded: Date.now(),
      }
      this.state.skins.unshift(skin)
      try {
        await this.saveState()
      } catch (e) {
        this.state.skins.shift()
        if (localSource) await remove(join(this.closetPath, `${id}.png`))
        throw e
      }
      return structuredClone(skin)
    })
  }

  async updateSkin(id: string, options: UpdateLocalSkinOptions): Promise<LocalSkin> {
    await this.initialize()
    return this.mutex.of(LOCAL_SKIN_LOCK).runExclusive(async () => {
      const index = this.state.skins.findIndex(skin => skin.id === id)
      if (index === -1) throw new Error(`Cannot find local skin ${id}`)
      const original = this.state.skins[index]
      const updated = {
        ...original,
        ...(options.name === undefined ? {} : { name: options.name.trim() || original.name }),
        ...(options.slim === undefined ? {} : { slim: options.slim }),
      }
      this.state.skins[index] = updated
      try {
        await this.saveState()
      } catch (e) {
        this.state.skins[index] = original
        throw e
      }
      return structuredClone(updated)
    })
  }

  async removeSkin(id: string): Promise<void> {
    await this.initialize()
    await this.mutex.of(LOCAL_SKIN_LOCK).runExclusive(async () => {
      const index = this.state.skins.findIndex(skin => skin.id === id)
      if (index === -1) return
      const [removed] = this.state.skins.splice(index, 1)
      const equippedSkinIds = { ...this.state.equippedSkinIds }
      for (const account of Object.keys(this.state.equippedSkinIds)) {
        if (this.state.equippedSkinIds[account] === id) delete this.state.equippedSkinIds[account]
      }
      try {
        await this.saveState()
      } catch (e) {
        this.state.skins.splice(index, 0, removed)
        this.state.equippedSkinIds = equippedSkinIds
        throw e
      }
      const localSource = this.getLocalSource(removed.url)
      const relativePath = localSource ? relative(this.closetPath, localSource) : undefined
      if (localSource && relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
        await remove(localSource)
      }
    })
  }

  async setEquippedSkin(account: string, id: string): Promise<void> {
    await this.initialize()
    await this.mutex.of(LOCAL_SKIN_LOCK).runExclusive(async () => {
      if (id && !this.state.skins.some(skin => skin.id === id)) {
        throw new Error(`Cannot find local skin ${id}`)
      }
      const original = this.state.equippedSkinIds[account]
      if (id) this.state.equippedSkinIds[account] = id
      else delete this.state.equippedSkinIds[account]
      try {
        await this.saveState()
      } catch (e) {
        if (original) this.state.equippedSkinIds[account] = original
        else delete this.state.equippedSkinIds[account]
        throw e
      }
    })
  }
}
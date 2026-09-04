import { AddLocalSkinOptions, AUTHORITY_MICROSOFT, LocalSkin, LocalSkinService as ILocalSkinService, LocalSkinServiceKey, LocalSkinState, ResolvedPlayerSkin, UpdateLocalSkinOptions } from '@xmcl/runtime-api'
import { writeFile as writeAtomically } from 'atomically'
import { randomUUID } from 'crypto'
import { copyFile, ensureDir, readFile, remove, writeFile } from 'fs-extra'
import { isAbsolute, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kYggdrasilSeriveRegistry, YggdrasilSeriveRegistry } from './YggdrasilSeriveRegistry'

const LOCAL_SKIN_LOCK = 'local-skin-service'

interface PlayerProfile {
  id: string
  name: string
  properties?: Array<{ name: string; value: string }>
}

@ExposeServiceKey(LocalSkinServiceKey)
export class LocalSkinService extends AbstractService implements ILocalSkinService {
  private readonly closetPath: string
  private readonly statePath: string
  private state: LocalSkinState = { skins: [], equippedSkinIds: {} }

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kYggdrasilSeriveRegistry) private readonly yggdrasilRegistry: YggdrasilSeriveRegistry,
  ) {
    super(app, async () => {
      await ensureDir(this.closetPath)
      this.state = await this.loadState()
      await this.migrateRemoteSkins()
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

  private async persistSource(source: string, target: string) {
    const localSource = this.getLocalSource(source)
    if (localSource) {
      const { fileTypeFromFile } = await import('file-type')
      const fileType = await fileTypeFromFile(localSource)
      if (fileType?.mime !== 'image/png') {
        throw new Error('The local skin must be a PNG image')
      }
      await copyFile(localSource, target)
      return
    }

    const response = await this.app.fetch(source)
    if (!response.ok) {
      throw new Error(`Cannot download skin from ${source}`)
    }
    const content = Buffer.from(await response.arrayBuffer())
    const { fileTypeFromBuffer } = await import('file-type')
    const fileType = await fileTypeFromBuffer(content)
    if (fileType?.mime !== 'image/png') {
      throw new Error('The remote skin must be a PNG image')
    }
    await writeFile(target, content)
  }

  private async migrateRemoteSkins() {
    let changed = false
    for (const skin of this.state.skins) {
      if (this.getLocalSource(skin.url)) continue
      const source = skin.source || skin.url
      const target = join(this.closetPath, `${skin.id}.png`)
      try {
        await this.persistSource(source, target)
        skin.source = source
        skin.url = this.getMediaUrl(target)
        changed = true
      } catch (e) {
        this.warn(`Fail to migrate remote skin ${skin.id} to ${target}`)
        this.warn(e as Error)
      }
    }
    if (changed) await this.saveState()
  }

  async getState(): Promise<LocalSkinState> {
    await this.initialize()
    return structuredClone(this.state)
  }

  async resolveSkin(authority: string, username: string): Promise<ResolvedPlayerSkin> {
    const cleanUsername = username.trim()
    if (!cleanUsername) throw new Error('Player name is required')

    let profile: PlayerProfile
    if (authority === AUTHORITY_MICROSOFT) {
      const profileResponse = await this.app.fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanUsername)}`)
      if (!profileResponse.ok) throw new Error(`Cannot find Minecraft player ${cleanUsername}`)
      profile = await profileResponse.json() as PlayerProfile
      profile = await this.fetchProfile(AUTHORITY_MICROSOFT, profile.id)
    } else {
      if (!this.yggdrasilRegistry.getYggdrasilServices().some(service => service.url === authority)) {
        throw new Error(`Unknown Yggdrasil authority ${authority}`)
      }
      const api = new URL(authority)
      const profilesUrl = new URL(`${api.pathname.replace(/\/$/, '')}/api/profiles/minecraft`, api.origin)
      const profileResponse = await this.app.fetch(profilesUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([cleanUsername]),
      })
      if (!profileResponse.ok) throw new Error(`Cannot query ${cleanUsername} from ${api.host}`)
      const profiles = await profileResponse.json() as PlayerProfile[]
      const matched = profiles.find(candidate => candidate.name.toLowerCase() === cleanUsername.toLowerCase()) ?? profiles[0]
      if (!matched?.id) throw new Error(`Cannot find ${cleanUsername} from ${api.host}`)
      profile = await this.fetchProfile(authority, matched.id)
    }

    const encodedTextures = profile.properties?.find(property => property.name === 'textures')?.value
    if (!encodedTextures) throw new Error(`Player ${cleanUsername} does not have a skin`)
    const textures = JSON.parse(Buffer.from(encodedTextures, 'base64').toString('utf-8')) as {
      textures?: { SKIN?: { url?: string; metadata?: { model?: string } } }
    }
    const skin = textures.textures?.SKIN
    if (!skin?.url) throw new Error(`Player ${cleanUsername} does not have a skin`)
    return { url: skin.url, slim: skin.metadata?.model === 'slim' }
  }

  private async fetchProfile(authority: string, id: string): Promise<PlayerProfile> {
    const api = authority === AUTHORITY_MICROSOFT ? new URL('https://sessionserver.mojang.com') : new URL(authority)
    const profileUrl = authority === AUTHORITY_MICROSOFT
      ? new URL(`/session/minecraft/profile/${encodeURIComponent(id)}`, api.origin)
      : new URL(`${api.pathname.replace(/\/$/, '')}/sessionserver/session/minecraft/profile/${encodeURIComponent(id)}`, api.origin)
    profileUrl.searchParams.set('unsigned', 'true')
    const response = await this.app.fetch(profileUrl)
    if (!response.ok) throw new Error(`Cannot load Minecraft profile ${id} from ${api.host}`)
    return response.json() as Promise<PlayerProfile>
  }

  async addSkin(options: AddLocalSkinOptions): Promise<LocalSkin> {
    await this.initialize()
    return this.mutex.of(LOCAL_SKIN_LOCK).runExclusive(async () => {
      const id = randomUUID()
      const target = join(this.closetPath, `${id}.png`)
      await this.persistSource(options.source, target)
      const skin: LocalSkin = {
        id,
        name: options.name.trim() || 'Custom Skin',
        url: this.getMediaUrl(target),
        source: options.source,
        slim: options.slim,
        dateAdded: Date.now(),
      }
      this.state.skins.unshift(skin)
      try {
        await this.saveState()
      } catch (e) {
        this.state.skins.shift()
        await remove(target)
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
import { parse as parseForgeSite } from '@xmcl/forge-site-parser'
import { LabyModManifest } from '@xmcl/installer'
import {
  FabricArtifactVersion,
  FabricVersionsResult,
  ForgeVersion,
  MinecraftVersions,
  OptifineVersion,
  VersionMetadataService as IVersionMetadataService,
  VersionMetadataServiceKey,
} from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { z } from 'zod'
import { Inject, LauncherAppKey } from '~/app'
import { kGFW } from '~/infra'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { kSettings, shouldOverrideApiSet } from '~/settings'
import { LauncherApp } from '../app/LauncherApp'
import { fetchVersionMetadata, VersionMetadataSource } from './versionMetadataCache'

const minecraftVersionSchema = z.object({
  id: z.string(),
  type: z.string(),
  time: z.string(),
  releaseTime: z.string(),
  url: z.string(),
}).passthrough()

const minecraftVersionsSchema = z.object({
  latest: z.object({
    release: z.string(),
    snapshot: z.string(),
  }),
  versions: z.array(minecraftVersionSchema),
}) satisfies z.ZodType<MinecraftVersions, any>

const forgeDownloadSchema = z.object({
  md5: z.string().optional(),
  sha1: z.string(),
  path: z.string(),
}).passthrough()

const forgeVersionSchema = z.object({
  mcversion: z.string().default(''),
  version: z.string().default(''),
  date: z.string().default(''),
  type: z.enum(['buggy', 'recommended', 'common', 'latest']).default('common'),
  installer: forgeDownloadSchema.optional(),
  universal: forgeDownloadSchema.optional(),
  changelog: forgeDownloadSchema.optional(),
  mdk: forgeDownloadSchema.optional(),
  source: forgeDownloadSchema.optional(),
  launcher: forgeDownloadSchema.optional(),
}).passthrough()

const forgeVersionsSchema = z.array(forgeVersionSchema) satisfies z.ZodType<ForgeVersion[], any>

const neoForgedVersionsSchema = z.array(z.string())

const fabricArtifactVersionSchema = z.object({
  gameVersion: z.string().optional(),
  separator: z.string().optional(),
  build: z.number().optional(),
  maven: z.string(),
  version: z.string(),
  stable: z.boolean().optional(),
}).passthrough()

const fabricVersionsSchema = z.object({
  gameVersions: z.array(z.string()),
  loaderVersions: z.array(fabricArtifactVersionSchema),
}) satisfies z.ZodType<FabricVersionsResult, any>

const optifineVersionSchema = z.object({
  mcversion: z.string(),
  type: z.string(),
  patch: z.string(),
}).passthrough()

const optifineVersionsSchema = z.array(optifineVersionSchema) satisfies z.ZodType<OptifineVersion[], any>

const labyModManifestSchema = z.object({
  labyModVersion: z.string(),
  commitReference: z.string(),
  sha1: z.string(),
  releaseTime: z.number(),
  size: z.number(),
  assets: z.object({
    shader: z.string(),
    common: z.string(),
    fonts: z.string(),
    'vanilla-theme': z.string(),
    'fancy-theme': z.string(),
    i18n: z.string(),
  }).passthrough(),
  minecraftVersions: z.array(z.object({
    tag: z.string(),
    version: z.string(),
    index: z.number(),
    type: z.string(),
    runtime: z.object({
      name: z.string(),
      version: z.number(),
    }).passthrough(),
    customManifestUrl: z.string(),
  }).passthrough()),
}).passthrough() satisfies z.ZodType<LabyModManifest, any>

@ExposeServiceKey(VersionMetadataServiceKey)
export class VersionMetadataService extends AbstractService implements IVersionMetadataService {
  private latest = {
    release: '1.21.8',
    snapshot: '21w37a',
  }

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
    // Clean up cache files that previous builds wrote with an empty
    // minecraft key (`forge-.json`, `neoforged-.json`). They poison the
    // singleton-keyed in-memory state for real lookups.
    unlink(this.cachePath('forge-.json')).catch(() => {})
    unlink(this.cachePath('neoforged-.json')).catch(() => {})
  }

  /**
   * Whether third-party mirror metadata sources (e.g. BMCLAPI) may be
   * queried at all. False when the user picked the official source, or
   * picked "auto" and is detected outside the GFW — in which case no
   * version-list lookup may touch a mirror.
   */
  async #useMirror(): Promise<boolean> {
    const [settings, gfw] = await Promise.all([
      this.app.registry.get(kSettings),
      this.app.registry.get(kGFW),
    ])
    return shouldOverrideApiSet(settings, gfw.inside)
  }

  getLatestRelease = () => {
    return this.latest.release
  }

  async getLatestMinecraftRelease() {
    return this.latest.release
  }

  async setLatestMinecraft(release: string, snapshot: string) {
    this.latest.release = release
    this.latest.snapshot = snapshot
  }

  private cachePath(name: string) {
    return this.getAppDataPath('version-metadata', name)
  }

  @Singleton((force) => `minecraft-${!!force}`)
  async getMinecraftVersions(force?: boolean): Promise<MinecraftVersions> {
    const sources: VersionMetadataSource<MinecraftVersions>[] = [
      {
        url: 'https://launchermeta.mojang.com/mc/game/version_manifest.json',
        parse: (r) => r.json() as Promise<MinecraftVersions>,
      },
    ]
    if (await this.#useMirror()) {
      sources.push({
        url: 'https://bmclapi2.bangbang93.com/mc/game/version_manifest.json',
        parse: (r) => r.json() as Promise<MinecraftVersions>,
      })
    }
    const data = await fetchVersionMetadata({
      app: this.app,
      cachePath: this.cachePath('minecraft.json'),
      schema: minecraftVersionsSchema,
      sources,
      logger: this.logger,
      force,
      onFresh: (fresh) => {
        this.latest.release = fresh.latest.release
        this.latest.snapshot = fresh.latest.snapshot
        this.emit('minecraftVersions', fresh)
      },
    })
    this.latest.release = data.latest.release
    this.latest.snapshot = data.latest.snapshot
    return data
  }

  @Singleton((mc, force) => `forge-${mc}-${!!force}`)
  async getForgeVersions(minecraft: string, force?: boolean): Promise<ForgeVersion[]> {
    if (!minecraft) return []
    const sources: VersionMetadataSource<ForgeVersion[]>[] = [
      {
        url: `https://files.minecraftforge.net/net/minecraftforge/forge/index_${minecraft}.html`,
        parse: async (r) => {
          const text = await r.text()
          if (!text) return []
          const page = parseForgeSite(text)
          return page.versions.map<ForgeVersion>(v => ({
            mcversion: v.mcversion,
            version: v.version,
            date: v.date,
            type: v.type,
            installer: v.installer,
            universal: v.universal,
            changelog: v.changelog,
            mdk: v.mdk,
            source: v.source,
            launcher: v.launcher,
          }))
        },
      },
    ]
    if (await this.#useMirror()) {
      sources.push({
        url: `https://bmclapi2.bangbang93.com/forge/minecraft/${minecraft}`,
        parse: async (r) => {
          const list = await r.json() as Array<{ mcversion?: string; version?: string; modified?: string }>
          return list
            .filter(v => typeof v.version === 'string' && v.version.length > 0)
            .map<ForgeVersion>(v => ({
              mcversion: v.mcversion ?? minecraft,
              version: v.version!,
              type: 'common',
              date: v.modified ?? '',
            }))
        },
      })
    }
    return fetchVersionMetadata({
      app: this.app,
      cachePath: this.cachePath(`forge-${minecraft}.json`),
      schema: forgeVersionsSchema,
      sources,
      logger: this.logger,
      force,
      onFresh: (versions) => this.emit('forgeVersions', { minecraft, versions }),
    })
  }

  @Singleton((mc, force) => `neoforged-${mc}-${!!force}`)
  async getNeoForgedVersions(minecraft: string, force?: boolean): Promise<string[]> {
    if (!minecraft) return []
    const prefix = minecraft.startsWith('1.') ? `${minecraft.substring(2)}.` : `${minecraft}.`
    const sources: VersionMetadataSource<string[]>[] = [
      {
        url: 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',
        parse: async (r) => {
          const data = await r.json() as { versions: string[] }
          return data.versions.filter(v => v.startsWith(prefix))
        },
      },
    ]
    if (await this.#useMirror()) {
      sources.push({
        url: `https://bmclapi2.bangbang93.com/neoforge/list/${minecraft}`,
        parse: async (r) => {
          const list = await r.json() as Array<{ version: string }>
          return list.map(v => v.version)
        },
      })
    }
    return fetchVersionMetadata({
      app: this.app,
      cachePath: this.cachePath(`neoforged-${minecraft}.json`),
      schema: neoForgedVersionsSchema,
      sources,
      logger: this.logger,
      force,
      onFresh: (versions) => this.emit('neoForgedVersions', { minecraft, versions }),
    })
  }

  @Singleton((force) => `fabric-${!!force}`)
  async getFabricVersions(force?: boolean): Promise<FabricVersionsResult> {
    const useMirror = await this.#useMirror()
    return this.#getLoaderVersions({
      name: 'fabric',
      loader: [
        'https://meta.fabricmc.net/v2/versions/loader',
        ...(useMirror ? ['https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader'] : []),
      ],
      game: [
        'https://meta.fabricmc.net/v2/versions/game',
        ...(useMirror ? ['https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game'] : []),
      ],
      force,
      event: 'fabricVersions',
    })
  }

  @Singleton((force) => `quilt-${!!force}`)
  async getQuiltVersions(force?: boolean): Promise<FabricVersionsResult> {
    const useMirror = await this.#useMirror()
    return this.#getLoaderVersions({
      name: 'quilt',
      loader: [
        'https://meta.quiltmc.org/v3/versions/loader',
        ...(useMirror ? ['https://bmclapi2.bangbang93.com/quilt-meta/v3/versions/loader'] : []),
      ],
      game: [
        'https://meta.quiltmc.org/v3/versions/game',
        ...(useMirror ? ['https://bmclapi2.bangbang93.com/quilt-meta/v3/versions/game'] : []),
      ],
      force,
      event: 'quiltVersions',
    })
  }

  async #getLoaderVersions(opts: {
    name: string
    loader: string[]
    game: string[]
    force?: boolean
    event: 'fabricVersions' | 'quiltVersions'
  }): Promise<FabricVersionsResult> {
    const loaderSources: VersionMetadataSource<FabricArtifactVersion[]>[] = opts.loader.map(url => ({
      url,
      parse: (r) => r.json() as Promise<FabricArtifactVersion[]>,
    }))
    const gameSources: VersionMetadataSource<string[]>[] = opts.game.map(url => ({
      url,
      parse: async (r) => {
        const list = await r.json() as Array<{ version: string }>
        return list.map(v => v.version)
      },
    }))
    // Loader/game pieces revalidate independently. Both `onFresh` paths
    // re-read the *current* (possibly still-stale) sibling and emit a single
    // combined event so the renderer always sees a consistent shape.
    let lastGame: string[] | undefined
    let lastLoader: FabricArtifactVersion[] | undefined
    const emitCombined = () => {
      if (lastGame && lastLoader) {
        this.emit(opts.event, { gameVersions: lastGame, loaderVersions: lastLoader })
      }
    }
    const [loaderVersions, gameVersions] = await Promise.all([
      fetchVersionMetadata({
        app: this.app,
        cachePath: this.cachePath(`${opts.name}-loader.json`),
        schema: z.array(fabricArtifactVersionSchema),
        sources: loaderSources,
        logger: this.logger,
        force: opts.force,
        onFresh: (v) => { lastLoader = v; emitCombined() },
      }),
      fetchVersionMetadata({
        app: this.app,
        cachePath: this.cachePath(`${opts.name}-game.json`),
        schema: z.array(z.string()),
        sources: gameSources,
        logger: this.logger,
        force: opts.force,
        onFresh: (v) => { lastGame = v; emitCombined() },
      }),
    ])
    lastLoader = loaderVersions
    lastGame = gameVersions
    return { gameVersions, loaderVersions }
  }

  @Singleton((force) => `optifine-${!!force}`)
  async getOptifineVersions(force?: boolean): Promise<OptifineVersion[]> {
    // OptiFine is distributed *only* via BMCLAPI — there is no official
    // source to fall back to. For official / outside-GFW users we honour the
    // "never touch a mirror" contract by not querying bmcl, but we still
    // serve any previously-cached version list from disk so the UI isn't
    // left permanently empty.
    const useMirror = await this.#useMirror()
    const sources: VersionMetadataSource<OptifineVersion[]>[] = useMirror
      ? [
        {
          url: 'https://bmclapi2.bangbang93.com/optifine/versionList',
          parse: (r) => r.json() as Promise<OptifineVersion[]>,
        },
      ]
      : []
    try {
      return await fetchVersionMetadata({
        app: this.app,
        cachePath: this.cachePath('optifine.json'),
        schema: optifineVersionsSchema,
        sources,
        logger: this.logger,
        // Without a permitted source there is nothing to refresh against;
        // fall back to the stale-while-revalidate cache read.
        force: force && useMirror,
        onFresh: (versions) => this.emit('optifineVersions', versions),
      })
    } catch {
      // Cold cache and no permitted source — nothing to show yet.
      return []
    }
  }

  @Singleton((force) => `labymod-${!!force}`)
  async getLabyModManifest(force?: boolean): Promise<LabyModManifest> {
    const sources: VersionMetadataSource<LabyModManifest>[] = [
      {
        url: 'https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/production/latest.json',
        parse: (r) => r.json() as Promise<LabyModManifest>,
      },
    ]
    return fetchVersionMetadata({
      app: this.app,
      cachePath: this.cachePath('labymod.json'),
      schema: labyModManifestSchema,
      sources,
      logger: this.logger,
      force,
      onFresh: (manifest) => this.emit('labyModManifest', manifest),
    })
  }
}

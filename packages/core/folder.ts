import { join } from 'path'

export interface MinecraftFolder {
  readonly root: string
}

/**
 * The Minecraft folder structure. All method will return the path related to a minecraft root like `.minecraft`.
 */
export class MinecraftFolder {
  /**
   * Normal a Minecraft folder from a folder or string
   */
  static from(location: MinecraftLocation) {
    return typeof location === 'string'
      ? new MinecraftFolder(location)
      : location instanceof MinecraftFolder
        ? location
        : new MinecraftFolder((location as any).root)
  }

  constructor(readonly root: string) {}

  get mods(): string {
    return join(this.root, 'mods')
  }
  get resourcepacks(): string {
    return join(this.root, 'resourcepacks')
  }
  get assets(): string {
    return join(this.root, 'assets')
  }
  get libraries(): string {
    return join(this.root, 'libraries')
  }
  get versions(): string {
    return this.getPath('versions')
  }
  get logs(): string {
    return this.getPath('logs')
  }
  get options(): string {
    return this.getPath('options.txt')
  }
  get launcherProfile(): string {
    return this.getPath('launcher_profiles.json')
  }
  get lastestLog(): string {
    return this.getPath('logs', 'latest.log')
  }
  get maps(): string {
    return this.getPath('saves')
  }
  get saves(): string {
    return this.getPath('saves')
  }
  get screenshots(): string {
    return this.getPath('screenshots')
  }

  getNativesRoot(version: string) {
    return join(this.getVersionRoot(version), version + '-natives')
  }
  getVersionRoot(version: string) {
    return join(this.versions, version)
  }
  getVersionJson(version: string) {
    return join(this.getVersionRoot(version), version + '.json')
  }
  getVersionServerJson(version: string) {
    return join(this.getVersionRoot(version), 'server.json')
  }
  getVersionJar(version: string, type?: string) {
    if (type === 'client' || !type) return join(this.getVersionRoot(version), version + '.jar')
    if (type === 'server')
      return this.getPath(
        'libraries',
        'net',
        'minecraft',
        'server',
        version,
        `server-${version}-bundled.jar`,
      )
    return join(this.getVersionRoot(version), version + `-${type}.jar`)
  }

  getVersionAll(version: string) {
    return [
      join(this.versions, version),
      join(this.versions, version, version + '.json'),
      join(this.versions, version, version + '.jar'),
    ]
  }

  getResourcePack(fileName: string) {
    return join(this.resourcepacks, fileName)
  }
  getMod(fileName: string) {
    return join(this.mods, fileName)
  }
  getLog(fileName: string) {
    return join(this.logs, fileName)
  }
  getMapInfo(map: string) {
    return this.getPath('saves', map, 'level.dat')
  }
  getMapIcon(map: string) {
    return this.getPath('saves', map, 'icon.png')
  }
  getLibraryByPath(libraryPath: string): string {
    return join(this.libraries, libraryPath)
  }

  getAssetsIndex(versionAssets: string): string {
    return this.getPath('assets', 'indexes', versionAssets + '.json')
  }
  getAsset(hash: string): string {
    return this.getPath('assets', 'objects', hash.substring(0, 2), hash)
  }
  getLogConfig(file: string): string {
    return this.getPath('assets', 'log_configs', file)
  }
  getPath(...path: string[]) {
    return join(this.root, ...path)
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MinecraftPath {
  export const mods = 'mods'
  export const resourcepacks = 'resourcepacks'
  export const assets = 'assets'
  export const libraries = 'libraries'
  export const versions = 'versions'
  export const logs = 'logs'
  export const options = 'options.txt'
  export const launcherProfile = 'launcher_profiles.json'
  export const lastestLog = 'logs/latest.log'
  export const maps = MinecraftPath.saves
  export const saves = 'saves'
  export const screenshots = 'screenshots'

  export function getVersionRoot(version: string) {
    return join('versions', version)
  }
  export function getNativesRoot(version: string) {
    return join('versions', version, version + '-natives')
  }
  export function getVersionJson(version: string) {
    return join('versions', version, version + '.json')
  }
  export function getVersionJar(version: string, type?: string) {
    return type === 'client' || type === undefined
      ? join('versions', version, version + '.jar')
      : join('versions', version, `${version}-${type}.jar`)
  }
  export function getResourcePack(fileName: string) {
    return join('resourcepacks', fileName)
  }
  export function getMod(fileName: string) {
    return join('mods', fileName)
  }
  export function getLog(fileName: string) {
    return join('logs', fileName)
  }
  export function getMapInfo(map: string) {
    return join('saves', map, 'level.dat')
  }
  export function getMapIcon(map: string) {
    return join('saves', map, 'icon.png')
  }
  export function getLibraryByPath(libraryPath: string) {
    return join('libraries', libraryPath)
  }
  export function getAssetsIndex(versionAssets: string) {
    return join('assets', 'indexes', versionAssets + '.json')
  }
  export function getAsset(hash: string): string {
    return join('assets', 'objects', hash.substring(0, 2), hash)
  }
}

export type MinecraftLocation = MinecraftFolder | string

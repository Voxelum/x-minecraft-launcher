import { MinecraftFolder, MinecraftLocation } from './folder'
import { Platform, getPlatform } from './platform'
import { extname } from 'path'
import { readFile } from 'fs/promises'
import { isNotNull } from './utils'

interface PartialResolvedVersion extends Version {
  libraries: ResolvedLibrary[]
  arguments: {
    game: Version.LaunchArgument[]
    jvm: Version.LaunchArgument[]
  }
  minecraftDirectory: string
}
/**
 * The resolved version for launcher.
 * It could be a combination of multiple versions as there might be some inheritions.
 *
 * You can get resolved version of a Minecraft by calling {@link Version.parse}.
 *
 * @see {@link Version.parse}
 */
export interface ResolvedVersion {
  /**
   * The id of the version, should be identical to the version folder.
   */
  id: string
  arguments: {
    game: Version.LaunchArgument[]
    jvm: Version.LaunchArgument[]
  }
  /**
   * The main class full qualified name
   */
  mainClass: string
  assetIndex?: Version.AssetIndex
  /**
   * The asset index id of this version. Should be something like `1.14`, `1.12`
   */
  assets: string
  downloads: {
    client?: Version.Download
    server?: Version.Download
    [key: string]: Version.Download | undefined
  }
  libraries: ResolvedLibrary[]

  minimumLauncherVersion: number
  releaseTime: string
  time: string
  type: string
  logging?: {
    [key: string]: {
      file: Version.Download & { id: string }
      argument: string
      type: string
    }
  }
  /**
   * Recommended java version
   */
  javaVersion: JavaVersion
  /**
   * The minecraft version of this version
   */
  minecraftVersion: string
  /**
   * The minecraft directory of this version
   */
  minecraftDirectory: string
  /**
   * The version inheritances of this whole resolved version.
   *
   * The first element is this version, and the last element is the root Minecraft version.
   * The dependencies of `[a, b, c]` should be `a -> b -> c`, where c is a Minecraft version.
   */
  inheritances: string[]

  /**
   * All array of json file paths.
   *
   * It's the chain of inherits json path. The root json will be the last element of the array.
   * The first element is the user provided version.
   */
  pathChain: string[]
}

export interface ResolvedServerVersion {
  id: string
  libraries: ResolvedLibrary[]
  mainClass: string
  jar?: string
  minecraftVersion: string
  arguments: {
    game: string[]
    jvm: string[]
  }
}

/**
 * The full library info. I can be resolved from path or maven library name.
 *
 * @see {@link LibraryInfo.resolveFromPath} {@link LibraryInfo.resolve}
 */
export interface LibraryInfo {
  readonly groupId: string
  readonly artifactId: string
  readonly version: string
  readonly isSnapshot: boolean
  /**
   * The file extension. Default is `jar`. Some files in forge are `zip`.
   */
  readonly type: string
  /**
   * The classifier. Normally, this is empty. For forge, it can be like `universal`, `installer`.
   */
  readonly classifier: string
  /**
   * The maven path.
   */
  readonly path: string
  /**
   * The original maven name of this library
   */
  readonly name: string
}

export interface BadVersionJsonError {
  error: 'BadVersionJson'
  missing: 'MainClass' | 'AssetIndex' | 'Downloads'
  version: string
}
export function isBadVersionJsonError(e: any): e is BadVersionJsonError {
  return e && e.error === 'BadVersionJson'
}
export interface CorruptedVersionJsonError {
  error: 'CorruptedVersionJson'
  version: string
  json: string
}
export function isCorruptedVersionJsonError(e: any): e is CorruptedVersionJsonError {
  return e && e.error === 'CorruptedVersionJson'
}
export interface MissingVersionJsonError {
  error: 'MissingVersionJson'
  version: string
  path: string
}
export function isMissingVersionJsonError(e: any): e is MissingVersionJsonError {
  return e && e.error === 'MissingVersionJson'
}

export interface CircularDependenciesError {
  error: 'CircularDependencies'
  /**
   * The version has circular dependencies
   */
  version: string

  chain: string[]
}

export type VersionParseError =
  | ((
      | BadVersionJsonError
      | CorruptedVersionJsonError
      | MissingVersionJsonError
      | CircularDependenciesError
    ) &
      Error)
  | Error

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LibraryInfo {
  /**
   * Resolve the library info from the maven path.
   * @param path The library path. It should look like `net/minecraftforge/forge/1.0/forge-1.0.jar`
   */
  export function resolveFromPath(path: string): LibraryInfo {
    const parts = path.split('/')
    const file = parts[parts.length - 1]
    const version = parts[parts.length - 2]
    const artifactId = parts[parts.length - 3]
    const groupId = parts.slice(0, parts.length - 3).join('.')

    const filePrefix = `${artifactId}-${version}`
    const ext = extname(file)
    const type = ext.substring(1)

    const isSnapshot = file.startsWith(version)

    let classifier = file.substring(
      isSnapshot ? version.length : filePrefix.length,
      file.length - ext.length,
    )

    if (classifier.startsWith('-')) {
      classifier = classifier.slice(1)
    }

    let name = `${groupId}:${artifactId}:${version}`
    if (classifier) {
      name += `:${classifier}`
    }
    if (type !== 'jar') {
      name += `@${type}`
    }

    return {
      type,
      groupId,
      artifactId,
      version,
      classifier,
      name,
      path,
      isSnapshot,
    }
  }
  /**
   * Get the base info of the library from its name
   *
   * @param lib The name of library or the library itself
   */
  export function resolve(lib: string | Version.Library | ResolvedLibrary): LibraryInfo {
    const name: string = typeof lib === 'string' ? lib : lib.name
    const [body, type = 'jar'] = name.split('@')
    const [groupId, artifactId, version, classifier = ''] = body.split(':')
    const isSnapshot = version.endsWith('-SNAPSHOT')

    const groupPath = groupId.replace(/\./g, '/')
    let base = `${groupPath}/${artifactId}/${version}/${artifactId}-${version}`
    if (classifier) {
      base += `-${classifier}`
    }
    const path = `${base}.${type}`

    return {
      type,
      groupId,
      artifactId,
      version,
      name,
      isSnapshot,
      classifier,
      path,
    }
  }
}

/**
 * A resolved library for launcher. It can by parsed from `LibraryInfo`.
 */
export class ResolvedLibrary implements LibraryInfo {
  readonly groupId: string
  readonly artifactId: string
  readonly version: string
  readonly isSnapshot: boolean
  readonly type: string
  readonly classifier: string
  readonly path: string
  constructor(
    readonly name: string,
    info: LibraryInfo,
    readonly download: Version.Artifact,
    readonly isNative: boolean = false,
    readonly checksums?: string[],
    readonly serverreq?: boolean,
    readonly clientreq?: boolean,
    readonly extractExclude?: string[],
  ) {
    const { groupId, artifactId, version, isSnapshot, type, classifier, path } = info
    this.groupId = groupId
    this.artifactId = artifactId
    this.version = version
    this.isSnapshot = isSnapshot
    this.type = type
    this.classifier = classifier
    this.path = path
  }
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Version {
  export interface Download {
    sha1: string
    size: number
    url: string
  }
  export interface AssetIndex extends Download {
    readonly id: string
    readonly totalSize: number
  }
  export interface Artifact extends Download {
    readonly path: string
  }
  export interface LoggingFile extends Download {
    readonly id: string
  }

  export interface NormalLibrary {
    name: string
    downloads: {
      artifact: Artifact
    }
  }
  export interface Rule {
    action: 'allow' | 'disallow'
    os?: Partial<Platform>
    features?: { [feat: string]: boolean }
  }
  export interface NativeLibrary {
    name: string
    downloads: {
      artifact: Artifact
      classifiers: {
        [os: string]: Artifact
      }
    }
    rules: Rule[]
    extract: {
      exclude: string[]
    }
    natives: {
      [os: string]: string
    }
  }

  export interface PlatformSpecificLibrary {
    name: string
    downloads: {
      artifact: Artifact
    }
    rules: Rule[]
  }
  export interface LegacyLibrary {
    name: string
    url?: string
    clientreq?: boolean
    serverreq?: boolean
    checksums?: string[]
  }

  export type Library = NormalLibrary | NativeLibrary | PlatformSpecificLibrary | LegacyLibrary

  export type LaunchArgument =
    | string
    | {
        rules?: Rule[]
        value: string | string[]
      }

  /**
   * Check if all the rules in `Rule[]` are acceptable in certain OS `platform` and features.
   * @param rules The rules usually comes from `Library` or `LaunchArgument`
   * @param platform The platform, leave it absent will use the `currentPlatform`
   * @param features The features, used by game launch argument `arguments.game`
   */
  export function checkAllowed(
    rules: Rule[],
    platform: Platform = getPlatform(),
    features: string[] = [],
  ): boolean {
    // by default it's allowed
    if (!rules || rules.length === 0) {
      return true
    }
    // else it's disallow by default
    let allow = false
    for (const rule of rules) {
      const action = rule.action === 'allow'
      // apply by default
      let apply = true
      if ('os' in rule && rule.os) {
        // don't apply by default if has os rule
        apply = false
        const osRule = rule.os
        if (
          platform.name === osRule.name &&
          (!osRule.version || platform.version.match(osRule.version))
        ) {
          apply = true
          if (osRule.arch) {
            const ruleArch = osRule.arch === 'x86' ? 'ia32' : osRule.arch
            apply = ruleArch === platform.arch
          }
        }
      }
      if (apply) {
        if ('features' in rule && rule.features) {
          const featureRequire = rule.features
          // only apply when the EVERY required features enabled & not required features disabled
          apply = Object.entries(featureRequire).every(([k, v]) =>
            v ? features.indexOf(k) !== -1 : features.indexOf(k) === -1,
          )
        }
      }
      if (apply) {
        allow = action
      }
    }
    return allow
  }
  /**
   * Recursively parse the version JSON.
   *
   * This function requires that the id in version.json is identical to the directory name of that version.
   *
   * e.g. .minecraft/<version-a>/<version-a.json> and in <version-a.json>:
   *```
   * { "id": "<version-a>", ... }
   * ```
   * The function might throw multiple parsing errors. You can handle them with type by this:
   * ```ts
   * try {
   *   await Version.parse(mcPath, version);
   * } catch (e) {
   *   let err = e as VersionParseError;
   *   switch (err.error) {
   *     case "BadVersionJson": // do things...
   *     // handle other cases
   *     default: // this means this is not a VersionParseError, handle error normally.
   *   }
   * }
   * ```
   *
   * @param minecraftPath The .minecraft path
   * @param version The vesion id.
   * @return The final resolved version detail
   * @throws {@link CorruptedVersionJsonError}
   * @throws {@link MissingVersionJsonError}
   * @throws {@link BadVersionJsonError}
   * @see {@link VersionParseError}
   */
  export async function parse(
    minecraftPath: MinecraftLocation,
    version: string,
    platofrm: Platform = getPlatform(),
  ): Promise<ResolvedVersion> {
    const folder = MinecraftFolder.from(minecraftPath)
    // the hierarchy is outer version to dep version
    // e.g. [liteloader version, forge version, minecraft version]
    const hierarchy = await resolveDependency(folder, version, platofrm)
    return resolve(minecraftPath, hierarchy)
  }

  /**
   * Parse the server version from the Minecraft folder.
   *
   * This is non-standard version json format, only contains server related information.
   *
   * @param minecraftPath The path of the Minecraft folder
   * @param version The version id
   * @returns The resolved server version
   */
  export async function parseServer(
    minecraftPath: MinecraftLocation,
    version: string,
  ): Promise<ResolvedServerVersion> {
    const folder = MinecraftFolder.from(minecraftPath)
    const filePath = folder.getVersionServerJson(version)
    const content = await readFile(filePath, 'utf-8')
    const profile = JSON.parse(content) as Version
    return {
      id: version,
      minecraftVersion: profile.inheritsFrom || profile.id,
      mainClass: profile.mainClass,
      jar: profile.jar,
      libraries: profile.libraries.map((l) => Version.resolveLibrary(l)).filter(isNotNull),
      arguments: {
        jvm: profile.arguments?.jvm || ([] as any),
        game: profile.arguments?.game || ([] as any),
      },
    }
  }

  /**
   * Resolve the given version hierarchy into `ResolvedVersion`.
   *
   * Some launcher has non-standard version json format to handle hierarchy,
   * and if you want to handle them, you can use this function to parse.
   *
   * @param minecraftPath The path of the Minecraft folder
   * @param hierarchy The version hierarchy, which can be produced by `normalizeVersionJson`
   * @throws {@link BadVersionJsonError}
   * @see {@link VersionParseError}
   * @see {@link normalizeVersionJson}
   * @see {@link parse}
   */
  export function resolve(minecraftPath: MinecraftLocation, hierarchy: PartialResolvedVersion[]) {
    const folder = MinecraftFolder.from(minecraftPath)

    const rootVersion = hierarchy[hierarchy.length - 1]
    const id: string = hierarchy[0].id
    let assetIndex: AssetIndex = rootVersion.assetIndex!
    let assets = ''

    const downloadsMap: { [key: string]: Download } = {}
    const librariesMap: { [key: string]: ResolvedLibrary } = {}
    const nativesMap: { [key: string]: ResolvedLibrary } = {}

    let mainClass = ''
    const args = { jvm: [] as LaunchArgument[], game: [] as LaunchArgument[] }
    let minimumLauncherVersion = 0
    let releaseTime = ''
    let time = ''
    let type = ''
    let logging: any
    const minecraftVersion: string =
      rootVersion.clientVersion ?? rootVersion._minecraftVersion ?? rootVersion.id
    let location: string
    let javaVersion: JavaVersion = { majorVersion: 8, component: 'jre-legacy' }

    const chains: string[] = hierarchy.map((j) => folder.getVersionRoot(j.id))
    const inheritances = hierarchy.map((j) => j.id)

    let json: PartialResolvedVersion
    do {
      json = hierarchy.pop()!
      minimumLauncherVersion = Math.max(json.minimumLauncherVersion || 0, minimumLauncherVersion)
      location = json.minecraftDirectory

      if (!Reflect.get(json, 'replace')) {
        args.game.push(...json.arguments.game)
        args.jvm.push(...json.arguments.jvm)
      } else {
        args.game = json.arguments.game
        args.jvm = json.arguments.jvm
      }

      releaseTime = json.releaseTime || releaseTime
      time = json.time || time
      logging = json.logging || logging
      assets = json.assets || assets
      type = json.type || type
      mainClass = json.mainClass || mainClass
      assetIndex = json.assetIndex || assetIndex
      javaVersion = json.javaVersion || javaVersion
      if (json.libraries) {
        json.libraries.forEach((lib) => {
          let libOrgName = `${lib.groupId}:${lib.artifactId}`
          if (lib.classifier) {
            libOrgName += `-${lib.classifier};`
          }
          if (lib.isNative) {
            nativesMap[libOrgName] = lib
          } else {
            librariesMap[libOrgName] = lib
          }
        })
      }
      if (json.downloads) {
        for (const key in json.downloads) {
          downloadsMap[key] = json.downloads[key]
        }
      }
    } while (hierarchy.length !== 0)

    if (!mainClass) {
      throw Object.assign(new Error(), {
        name: 'BadVersionJson',
        error: 'BadVersionJson',
        version: id,
        missing: 'MainClass',
      } as BadVersionJsonError)
    }

    return {
      id,
      assetIndex,
      assets,
      minecraftVersion,
      inheritances,
      arguments: args,
      downloads: downloadsMap,
      libraries: Object.keys(librariesMap)
        .map((k) => librariesMap[k])
        .concat(Object.keys(nativesMap).map((k) => nativesMap[k])),
      mainClass,
      minimumLauncherVersion,
      releaseTime,
      time,
      type,
      logging,
      pathChain: chains,
      minecraftDirectory: location,
      javaVersion,
    } as ResolvedVersion
  }

  /**
   * Simply extends the version (actaully mixin)
   *
   * The result version will have the union of two version's libs. If one lib in two versions has different version, it will take the extra version one.
   * It will also mixin the launchArgument if it could.
   *
   * This function can be used for mixin forge and liteloader version.
   *
   * This function will throw an Error if two version have different assets. It doesn't care about the detail version though.
   *
   * @beta
   * @param id The new version id
   * @param parent The parent version will be inherited
   * @param version The version info which will overlap some parent information
   * @return The raw version json could be save to the version json file
   */
  export function inherits(id: string, parent: Version, version: Version): Version {
    const launcherVersion = Math.max(parent.minimumLauncherVersion, version.minimumLauncherVersion)

    const libMap: { [name: string]: Library } = {}
    parent.libraries.forEach((l) => {
      libMap[l.name] = l
    })
    const libraries = version.libraries.filter((l) => libMap[l.name] === undefined)

    const result: Version = {
      id,
      time: new Date().toISOString(),
      releaseTime: new Date().toISOString(),
      type: version.type,
      libraries,
      mainClass: version.mainClass,
      inheritsFrom: parent.id,
      minimumLauncherVersion: launcherVersion,
    }

    if (typeof parent.minecraftArguments === 'string') {
      if (typeof version.arguments === 'object') {
        throw new TypeError('Extends require two version in same format!')
      }
      result.minecraftArguments = mixinArgumentString(
        parent.minecraftArguments,
        version.minecraftArguments || '',
      )
    } else if (typeof parent.arguments === 'object') {
      if (typeof version.minecraftArguments === 'string') {
        throw new TypeError('Extends require two version in same format!')
      }
      result.arguments = version.arguments
    }

    return result
  }

  /**
   * Mixin the string arguments
   * @beta
   * @param hi Higher priority argument
   * @param lo Lower priority argument
   */
  export function mixinArgumentString(hi: string, lo: string): string {
    const arrA = hi.split(' ')
    const arrB = lo.split(' ')
    const args: { [key: string]: string[] } = {}
    for (let i = 0; i < arrA.length; i++) {
      // collection higher priority argument
      const element = arrA[i]
      if (!args[element]) {
        args[element] = []
      }
      if (arrA[i + 1]) {
        args[element].push(arrA[(i += 1)])
      }
    }
    for (let i = 0; i < arrB.length; i++) {
      // collect lower priority argument
      const element = arrB[i]
      if (!args[element]) {
        args[element] = []
      }
      if (arrB[i + 1]) {
        args[element].push(arrB[(i += 1)])
      }
    }
    const out: string[] = []
    for (const k of Object.keys(args)) {
      switch (k) {
        case '--tweakClass': {
          const set: { [arg: string]: 0 } = {}
          for (const v of args[k]) {
            set[v] = 0
          }
          Object.keys(set).forEach((v) => out.push(k, v))
          break
        }
        default:
          if (args[k][0]) {
            out.push(k, args[k][0])
          } // use higher priority argument in common
          break
      }
    }
    return out.join(' ')
  }

  /**
   * Resolve the dependencies of a minecraft version
   * @param path The path of minecraft
   * @param version The version id
   * @returns All the version required to run this version, including this version
   * @throws {@link CorruptedVersionJsonError}
   * @throws {@link MissingVersionJsonError}
   */
  export async function resolveDependency(
    path: MinecraftLocation,
    version: string,
    platform: Platform = getPlatform(),
  ): Promise<PartialResolvedVersion[]> {
    const folder = MinecraftFolder.from(path)
    const stack: PartialResolvedVersion[] = []

    async function walk(versionName: string) {
      const jsonPath = folder.getVersionJson(versionName)
      let contentString: string
      try {
        contentString = await readFile(jsonPath, 'utf-8')
      } catch (err) {
        const e: any = err
        throw Object.assign(new Error(e.message), {
          name: 'MissingVersionJson',
          error: 'MissingVersionJson',
          version: versionName,
          path: jsonPath,
        } as MissingVersionJsonError)
      }
      let nextVersion: string | undefined
      try {
        const versionJson = normalizeVersionJson(contentString, folder.root, platform)
        stack.push(versionJson)
        nextVersion = versionJson.inheritsFrom
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw Object.assign(new Error(e.message), {
            name: 'CorruptedVersionJson',
            error: 'CorruptedVersionJson',
            version: versionName,
            json: contentString,
          } as CorruptedVersionJsonError)
        }
        throw e
      }
      if (nextVersion) {
        if (stack.some((v) => v.id === nextVersion)) {
          throw Object.assign(new Error('Cannot resolve circular dependencies'), {
            name: 'CircularDependenciesError',
            error: 'CircularDependenciesError',
            version,
            chain: stack.map((v) => v.id).concat(nextVersion),
          })
        }
        await walk(nextVersion)
      }
    }
    await walk(version)

    return stack
  }

  export function resolveLibrary(
    lib: Library,
    platform: Platform = getPlatform(),
  ): ResolvedLibrary | undefined {
    if ('rules' in lib && !checkAllowed(lib.rules, platform)) {
      return undefined
    }
    // official natives foramt
    if ('natives' in lib) {
      if (!lib.natives[platform.name]) {
        return undefined
      }
      // eslint-disable-next-line no-template-curly-in-string
      const classifier = lib.natives[platform.name].replace('${arch}', platform.arch.substring(1))
      let nativeArtifact = lib.downloads?.classifiers?.[classifier]
      const info = LibraryInfo.resolve(lib.name + ':' + classifier)
      if (!nativeArtifact) {
        nativeArtifact = {
          path: info.path,
          sha1: '',
          size: -1,
          url: 'https://libraries.minecraft.net/' + info.path,
        }
      }
      if (!nativeArtifact.path) {
        nativeArtifact = {
          ...nativeArtifact,
          path: info.path,
        }
      }
      return new ResolvedLibrary(
        lib.name + ':' + classifier,
        info,
        nativeArtifact,
        true,
        undefined,
        undefined,
        undefined,
        lib.extract ? (lib.extract.exclude ? lib.extract.exclude : undefined) : undefined,
      )
    }
    const info = LibraryInfo.resolve(lib.name)
    // normal library
    if ('downloads' in lib) {
      if (!lib.downloads.artifact) {
        throw new Error('Corrupted library: ' + JSON.stringify(lib))
      }
      if (!lib.downloads.artifact.url) {
        lib.downloads.artifact.url =
          info.groupId === 'net.minecraftforge'
            ? 'https://files.minecraftforge.net/maven/' + lib.downloads.artifact.path
            : 'https://libraries.minecraft.net/' + lib.downloads.artifact.path
      }
      if (!lib.downloads.artifact.path) {
        lib.downloads.artifact = {
          ...lib.downloads.artifact,
          path: info.path,
        }
      }
      // if (info.classifier.startsWith('natives')) {
      //   // new native format introduced by 1.19
      //   return new ResolvedLibrary(info.name, info, lib.downloads.artifact, true)
      // }
      return new ResolvedLibrary(lib.name, info, lib.downloads.artifact)
    }
    const maven = lib.url || 'https://libraries.minecraft.net/'
    const artifact: Artifact = {
      size: -1,
      sha1: lib.checksums ? lib.checksums[0] : '',
      path: info.path,
      url: maven + info.path,
    }
    return new ResolvedLibrary(
      lib.name,
      info,
      artifact,
      false,
      lib.checksums,
      lib.serverreq,
      lib.clientreq,
    )
  }

  /**
   * Resolve all these library and filter out os specific libs
   * @param libs All raw lib
   * @param platform The platform
   */
  export function resolveLibraries(
    libs: Library[],
    platform: Platform = getPlatform(),
  ): ResolvedLibrary[] {
    return libs
      .map((lib) => resolveLibrary(lib, platform))
      .filter((l) => l !== undefined) as ResolvedLibrary[]
  }

  /**
   * Normalize a single version json.
   *
   * This function will force legacy version format into new format.
   * It will convert `minecraftArguments` into `arguments.game` and generate a default `arguments.jvm`
   *
   * This will pre-process the libraries according to the rules fields and current platform.
   * Non-matched libraries will be filtered out.
   *
   * This will also pre-process the jvm arguments according to the platform (os) info it provided.
   *
   * @param versionString The version json string
   * @param root The root of the version
   */
  export function normalizeVersionJson(
    versionString: string,
    root: string,
    platform: Platform = getPlatform(),
  ): PartialResolvedVersion {
    function processArguments(ar: Version.LaunchArgument[]) {
      return ar.filter((a) => {
        // only filter out the os only rule.
        // if the features fields presented, we don't process it now
        if (
          typeof a === 'object' &&
          a.rules?.every((r) => typeof r === 'string' || !('features' in r))
        ) {
          return Version.checkAllowed(a.rules, platform)
        }
        return true
      })
    }
    const parsed: Version = JSON.parse(versionString)
    // if we legacy version json don't have argument, but have minecraftArugments
    const legacyVersionJson = !parsed.arguments && !!parsed.minecraftArguments
    const libraries = Version.resolveLibraries(parsed.libraries || [], platform)
    const args = {
      jvm: [] as Version.LaunchArgument[],
      game: [] as Version.LaunchArgument[],
    }
    if (!parsed.arguments) {
      // old version
      args.game = parsed.minecraftArguments ? parsed.minecraftArguments.split(' ') : []
      args.jvm = [
        {
          rules: [
            {
              action: 'allow',
              os: {
                name: 'windows',
              },
            },
          ],
          value:
            '-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump',
        },
        {
          rules: [
            {
              action: 'allow',
              os: {
                name: 'windows',
                version: '^10\\.',
              },
            },
          ],
          value: ['-Dos.name=Windows 10', '-Dos.version=10.0'],
        },
        // eslint-disable-next-line no-template-curly-in-string
        '-Djava.library.path=${natives_directory}',
        // eslint-disable-next-line no-template-curly-in-string
        '-Dminecraft.launcher.brand=${launcher_name}',
        // eslint-disable-next-line no-template-curly-in-string
        '-Dminecraft.launcher.version=${launcher_version}',
        '-cp',
        // eslint-disable-next-line no-template-curly-in-string
        '${classpath}',
      ]
    } else {
      args.jvm = parsed.arguments.jvm || []
      args.game = parsed.arguments.game || []
    }

    args.jvm = processArguments(args.jvm)
    const partial = {
      ...parsed,
      libraries,
      arguments: args,
      minecraftDirectory: root,
      // we want to replace the arguments for every version json in legacy version json
      replace: legacyVersionJson,
    }
    return partial
  }
}

export interface JavaVersion {
  /**
   * Corresponding with java manifest json.
   * @example "jre-legacy"
   */
  component: string
  majorVersion: number
}

/**
 * The raw json format provided by Minecraft. Also the namespace of version operation.
 *
 * Use `parse` to parse a Minecraft version json on the disk, and see the detail info of the version.
 *
 * With `ResolvedVersion`, you can use the resolved version to launch the game.
 *
 * @see {@link Version.parse}
 * @see {@link launch}
 */
export interface Version {
  id: string
  time: string
  type: string
  releaseTime: string
  inheritsFrom?: string
  minimumLauncherVersion: number

  minecraftArguments?: string
  arguments?: {
    game: Version.LaunchArgument[]
    jvm: Version.LaunchArgument[]
  }

  mainClass: string
  libraries: Version.Library[]

  jar?: string

  assetIndex?: Version.AssetIndex
  assets?: string
  downloads?: {
    client: Version.Download
    server: Version.Download
    [key: string]: Version.Download
  }

  client?: string
  server?: string
  logging?: {
    [key: string]: {
      file: Version.Download
      argument: string
      type: string
    }
  }

  javaVersion?: JavaVersion
  /**
   * NON CONVERSION! This only present in some third party launcher like PCL to mark the real minecraft version
   */
  clientVersion?: string
  /**
   * NON CONVERSION! This only present in some third party launcher like Labymod to mark the real minecraft version
   */
  _minecraftVersion?: string
  /**
   * NON CONVERSION! This only present in some third party launcher like Forge to mark the forge version
   */
  _forgeVersion?: string
  /**
   * NON CONVERSION! This only present in some third party launcher like Fabric to mark the fabric version
   */
  _fabricLoaderVersion?: string
}

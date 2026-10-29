import { LibraryInfo, MinecraftFolder, Version } from '@xmcl/core'
import { filterEntries, open, readEntry } from '@xmcl/unzip'
import { readFile, stat } from 'fs/promises'
import { delimiter, dirname, isAbsolute, join, relative } from 'path'
import type { InstallTask } from './installManifest'
import { resolveLibraryInstallFiles, type LibraryOptions } from './libraries'
import { parseManifest } from './manifest'
import {
  classpathEntryToLibraryName,
  parseArgumentsFromArgsFile,
  PostProcessBadJarError,
  PostProcessNoMainClassError,
  resolveProcessors,
  type InstallProfile,
} from './profile'

/** Resolve the server launch metadata only after the installer processors finish.
 * Planning reads their outputs; all writes/downloads remain executor operations.
 */
export async function resolveForgeServerProfileTasks(options: {
  id: string
  minecraft: MinecraftFolder
  profile: InstallProfile
  version?: string
  minecraftVersion?: string
  installOptions: LibraryOptions
}): Promise<InstallTask[]> {
  const { minecraft, profile } = options
  const version = options.version ?? profile.version
  const client: Version = JSON.parse(await readFile(minecraft.getVersionJson(version), 'utf8'))
  const minecraftVersion = options.minecraftVersion ?? profile.minecraft ?? client.inheritsFrom
  const server: Version = {
    id: version,
    inheritsFrom: minecraftVersion,
    type: client.type || 'release',
    time: client.time,
    releaseTime: client.releaseTime,
    minimumLauncherVersion: 13,
    mainClass: '',
    libraries: [],
    arguments: { game: [], jvm: [] },
  }
  const metadata = new Map([...(profile.libraries ?? []), ...client.libraries].map((l) => [l.name, l]))
  const required = new Map<string, Version['libraries'][number]>()
  const addLibrary = (name: string, classpath = true) => {
    const lib = metadata.get(name) ?? { name }
    required.set(name, lib)
    if (classpath && !server.libraries.some((l) => l.name === name)) server.libraries.push(lib)
  }
  const addPath = (path: string, classpath = true) => {
    const normalized = isAbsolute(path) ? relative(minecraft.libraries, path) : path
    const name = classpathEntryToLibraryName(normalized)
    if (name) addLibrary(name, classpath)
  }

  const argsName = process.platform === 'win32' ? 'win_args.txt' : 'unix_args.txt'
  const argsPath = resolveProcessors('server', profile, minecraft)
    .flatMap((p) => p.args)
    // Extraction commands mention both an archive source (data/win_args.txt)
    // and an absolute --to destination. Only the latter is readable on disk.
    .find((arg) => isAbsolute(arg) && arg.endsWith(argsName))
  let txtPath = argsPath
  // New installers can ship args files without a processor referring to them.
  if (!txtPath) {
    const installer = profile.data?.INSTALLER?.server
    const artifact = installer?.startsWith('[') ? installer.slice(1, -1) : profile.path
    if (artifact) {
      const candidate = join(dirname(minecraft.getLibraryByPath(LibraryInfo.resolve(artifact).path)), argsName)
      if (await isFile(candidate)) txtPath = candidate
    }
  }

  let jar: string | undefined
  if (txtPath) {
    const content = await readFile(txtPath, 'utf8')
    jar = parseArgumentsFromArgsFile(content, dirname(txtPath), server)
  } else {
    // Legacy versionInfo installers (including 1.7.10) have no processors,
    // profile.path, or top-level libraries. Their extracted universal is the
    // executable; the client LaunchWrapper main class is NOT a server main.
    const name = profile.path || client.libraries.find((l) =>
      l.name.startsWith('net.minecraftforge:forge:') ||
      l.name.startsWith('net.minecraftforge:minecraftforge:'))?.name
    if (!name) throw new Error(`Missing Forge server artifact: ${version}`)
    jar = minecraft.getLibraryByPath(LibraryInfo.resolve(name).path)
  }

  if (jar) {
    const zip = await open(jar, { lazyEntries: true, autoClose: false })
    try {
      const [manifestEntry, shimEntry] = await filterEntries(zip, ['META-INF/MANIFEST.MF', 'bootstrap-shim.list'])
      if (manifestEntry) {
        const manifest = parseManifest((await readEntry(zip, manifestEntry)).toString().replace(/\r?\n/g, '\r\n'))
        server.mainClass = manifest.mainClass
        // Jar-mode installers historically rely on the version's dependencies
        // in addition to the manifest. Never copy client-only native artifacts.
        if (!shimEntry) {
          for (const lib of client.libraries) {
            if (!('natives' in lib) && !lib.name.endsWith(':client')) addLibrary(lib.name)
          }
        }
        for (const path of manifest.classPath) addPath(path)
        addPath(jar)
      }
      if (shimEntry) {
        // The shim's embedded list is its runtime dependency set, not the
        // installer's client classpath (which includes an incompatible client jar).
        const content = (await readEntry(zip, shimEntry)).toString()
        for (const line of content.split(/\r?\n/)) {
          const [, name] = line.trim().split('\t')
          if (name) addLibrary(name)
        }
      }
    } catch (e) {
      throw new PostProcessBadJarError(jar, e as Error)
    } finally {
      zip.close()
    }
  }
  if (!server.mainClass) throw new PostProcessNoMainClassError(jar ?? txtPath ?? version)

  // The launch service rebuilds an absolute -cp from server.json. Preserve the
  // FULL official classpath, including bundler-extracted vanilla dependencies
  // and multi-segment classifiers, rather than borrowing the client libraries.
  const jvm = server.arguments!.jvm as string[]
  const paths = (value: string, classpath: boolean) => {
    for (const path of value.split(delimiter)) {
      if (path) addPath(path, classpath)
    }
  }
  for (let i = 0; i < jvm.length; i++) {
    if (['-cp', '-classpath', '--class-path'].includes(jvm[i])) {
      if (jvm[i + 1]) paths(jvm[i + 1], true)
      jvm.splice(i, 2)
      i--
    } else if (jvm[i].startsWith('--class-path=')) {
      paths(jvm[i].slice('--class-path='.length), true)
      jvm.splice(i--, 1)
    } else if (['-p', '--module-path', '--upgrade-module-path'].includes(jvm[i]) && jvm[i + 1]) {
      // Module-path libraries must be installed, but not added to -cp. Keep
      // these paths relative: the server exporter copies/rebases them.
      paths(jvm[i + 1], false)
      i++
    } else if (/^(--module-path=|--upgrade-module-path=|-DlegacyClassPath=)/.test(jvm[i])) {
      paths(jvm[i].slice(jvm[i].indexOf('=') + 1), false)
    }
  }

  // Older NeoForm pipelines emit these local-only outputs; newer unified
  // processors do not. Never request nonexistent artifacts from Maven.
  const game = server.arguments!.game
  const neoForm = game[game.indexOf('--fml.neoFormVersion') + 1]
  if (game.includes('--fml.neoFormVersion') && typeof neoForm === 'string') {
    for (const classifier of ['extra', 'srg']) {
      const name = `net.minecraft:server:${minecraftVersion}-${neoForm}:${classifier}`
      if (await isFile(minecraft.getLibraryByPath(LibraryInfo.resolve(name).path))) addLibrary(name)
    }
  }

  const filesId = `${options.id}:final-files`
  const path = minecraft.getVersionServerJson(version)
  return [{
    id: filesId,
    type: 'files',
    files: resolveLibraryInstallFiles(Version.resolveLibraries([...required.values()]), minecraft, options.installOptions),
  }, {
    id: `${options.id}:server-profile`,
    type: 'materialize',
    dependsOn: [filesId],
    operations: [{ type: 'write', path, content: JSON.stringify(server, null, 4) }],
    outputs: [{ path, validator: 'json' }],
  }]
}

async function isFile(path: string) {
  return stat(path).then((s) => s.isFile(), (e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return false
    throw e
  })
}

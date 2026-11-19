import { parseJavaVersion, resolveJava, resolveJavaWithDiagnostic, scanLocalJava } from '@xmcl/installer'
import {
  JavaRecordSchema,
  JavaServiceKey,
  JavaState,
  JavasSchema,
  type JavaService as IJavaService,
  type Java,
  type JavaRecord,
  type SharedState,
} from '@xmcl/runtime-api'
import { readFile, readJson, stat, remove } from 'fs-extra'
import { writeFile as writeFileAtomically } from 'atomically'
import { isSystemError } from '@xmcl/utils'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import {
  JavaValidation,
  detectLibc,
  detectExecutableLibc,
  getJavaExeFilePath,
  getManagedJavaComponent,
  validateJavaPath,
} from '~/java'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { getJavaRuntimeVersionFromName } from './javaInstallUtils'
import { LauncherApp } from '../app/LauncherApp'
import { LaunchService } from '../launch/LaunchService'
import { javaRuntimeLockKey, withJavaRuntimeLock } from './javaRuntimeLock'
import { getJavaReferenceGate } from './javaReferenceGate'
import { matchesJavaRuntimeIdentity, readJavaReplacementJournal, removeJavaReplacementJournal } from './javaReplacementJournal'
import { cleanupAbandonedJavaStaging } from './javaStaging'
import { InstanceService } from '../instance/InstanceService'
import { kSettings } from '../settings/settings'

import { readdirIfPresent } from '../util/fs'
import { requireString } from '../util/object'
import { ensureClass, getJavaArch } from './detectJVMArch'
import { getRestoreGate } from '~/infra/restoreGate'
import {
  getAdoptiumJavaPaths,
  getJavaPathsLinux,
  getJavaPathsLinuxSDK,
  getJavaPathsOSX,
  getMojangJavaPaths,
  getOpenJdkPaths,
  getOrcaleJavaPaths,
  getZuluJdkPath,
} from './javaPaths'

const JAVA_PROBE_TIMEOUT = 5000

@ExposeServiceKey(JavaServiceKey)
export class JavaService extends StatefulService<JavaState> implements IJavaService {
  private readonly removalGenerations = new Map<string, number>()

  /** Group removal generations by managed runtime rather than executable path. */
  private removalKey(path: string) {
    return getManagedJavaComponent(path, this.getPath('jre'))?.component ?? path
  }

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(
      app,
      () => store.registerStatic(new JavaState(), JavaServiceKey),
      async () => {
        ensureClass(this.app).catch((e) => {
          this.error(e)
        })

        const javaJsonPath = this.getAppDataPath('java.json')
        let raw: unknown
        try {
          raw = await readJson(javaJsonPath)
        } catch (error) {
          if (!isSystemError(error) || error.code !== 'ENOENT') throw error
          raw = { all: [] }
        }
        if (!raw || typeof raw !== 'object' || !('all' in raw) || !Array.isArray(raw.all)) {
          throw new Error(`Invalid Java cache: ${javaJsonPath}`)
        }
        const data = JavasSchema.parse(raw)
        const jreRoot = this.getPath('jre')
        void cleanupAbandonedJavaStaging(jreRoot).catch((error: unknown) =>
          this.error(error instanceof Error ? error : new Error(String(error))),
        )
        const valid = data.all
          .filter((l) => typeof l.path === 'string')
          .map((a) => {
            const managed = getManagedJavaComponent(a.path, jreRoot)
            const managedVersion = managed && getJavaRuntimeVersionFromName(managed.component)
            return {
              ...a,
              version: managedVersion ?? a.version,
              valid: true,
              isInternal: !!managed && !!a.installVendor && a.isInternal !== false,
            }
          })
        this.log(`Loaded ${valid.length} java from cache.`)
        this.state.javaUpdate(valid)

        const writer = getRestoreGate(app).writer(async () => {
          const all = []
          for (const j of this.state.all) {
            const parsed = JavaRecordSchema.safeParse(j)
            if (parsed.success) {
              all.push(parsed.data)
            } else {
              this.warn(`Invalid java schema detected for ${j.path}, skip it from cache.`)
            }
          }
          await writeFileAtomically(javaJsonPath, JSON.stringify({ all }, null, 2))
        }, 0, 'java-update')
        this.state.subscribeAll(() => writer.schedule())
        app.registryDisposer(() => writer.flush())

        // Recover replacements published before their cache entry was persisted.
        for (const component of await readdirIfPresent(jreRoot)) {
          if (component.startsWith('.')) continue
          const directory = join(jreRoot, component)
          try {
            const replacement = await readJavaReplacementJournal(directory, jreRoot, app.platform.os === 'windows')
            if (!replacement) continue
            this.state.javaUpdate(replacement)
          } catch (error) {
            this.warn(`Cannot recover Java replacement journal in ${directory}`)
            this.error(error instanceof Error ? error : new Error(String(error)))
          }
        }
        await writer.flush(true)
        this.refreshLocalJava().catch((e) => this.error(e))
      },
    )
  }

  setJavaSettings(javaPath: string, prependCommand?: string, vmOptions?: string[]): Promise<void> {
    const found = this.state.all.find((j) => j.path === javaPath)

    if (!found) {
      return Promise.resolve()
    }

    this.state.javaUpdate({ ...found, prependCommand, vmOptions })
    return Promise.resolve()
  }

  /** Persist pending Java, instance, and settings writes before runtime removal. */
  async flushJavaUpdate(): Promise<void> {
    await this.initialize()
    await getRestoreGate(this.app).flushWriters('java-update')
  }

  /** Clear and persist replacement state after cleanup or a safe decision to retain the old runtime. */
  async completeJavaReplacement(javaPath: string): Promise<void> {
    await this.initialize()
    const found = this.state.all.find((java) => java.path === javaPath)
    if (!found) throw new Error(`Cannot complete missing Java replacement: ${javaPath}`)
    const component = getManagedJavaComponent(javaPath, this.getPath('jre'))?.component
    if (!component) throw new Error(`Cannot complete unmanaged Java replacement: ${javaPath}`)
    const pending = { ...found }
    await removeJavaReplacementJournal(join(this.getPath('jre'), component))
    this.state.javaUpdate({ ...found, replacesJava: '', replacementRuntime: '', replacementIdentity: '' })
    try {
      await this.flushJavaUpdate()
    } catch (error) {
      this.state.javaUpdate(pending)
      throw error
    }
  }

  /** Validate replacement bookkeeping and identify references to the old runtime. */
  private getPendingReplacement(replacementPath: string, expectedOldPath?: string) {
    const root = resolve(this.getPath('jre'))
    const replacement = this.state.all.find(record => record.path === replacementPath)
    const old = replacement?.replacesJava && getManagedJavaComponent(replacement.replacesJava, root)?.component
    const newComponent = getManagedJavaComponent(replacementPath, root)?.component
    const same = (a: string, b: string) => this.app.platform.os === 'windows'
      ? a.toLowerCase() === b.toLowerCase()
      : a === b
    if (!old || !newComponent || same(old, newComponent) || !replacement?.valid ||
      !replacement.isInternal || !replacement.replacementRuntime ||
      (expectedOldPath !== undefined && replacement.replacesJava !== expectedOldPath) ||
      !same(resolve(replacement.replacementRuntime), join(root, old))) {
      throw new Error('Cannot safely process an unverified Java replacement')
    }
    return {
      replacement,
      oldRuntime: join(root, old),
      usesOldRuntime: (path: string | undefined) => {
        const component = path && getManagedJavaComponent(path, root)?.component
        return !!component && same(component, old)
      },
    }
  }

  /** Revalidate a replacement executable and its Java major before migration or removal. */
  private async verifyJavaReplacement(replacementPath: string, expectedOldPath?: string) {
    const { replacement } = this.getPendingReplacement(replacementPath, expectedOldPath)
    if (await validateJavaPath(replacementPath) !== JavaValidation.Okay) {
      throw new Error(`Java replacement is missing or inaccessible: ${replacementPath}`)
    }
    const executable = await resolveJava(replacementPath, { timeout: JAVA_PROBE_TIMEOUT })
    if (!executable || executable.majorVersion !== replacement.majorVersion) {
      throw new Error(`Java replacement could not be validated: ${replacementPath}`)
    }
    const old = this.state.all.find(java => java.path === replacement.replacesJava)
    if (old && old.majorVersion > 0 && executable.majorVersion !== old.majorVersion) {
      throw new Error(`Java replacement has a different major version: ${replacementPath}`)
    }
    return this.getPendingReplacement(replacementPath, expectedOldPath)
  }

  /** Migrate instance and global references if the old runtime identity still matches. */
  async migrateJavaReferences(replacementPath: string): Promise<boolean> {
    await this.initialize()
    const instanceService = await this.app.registry.getOrCreate(InstanceService)
    const instances = await instanceService.getSharedInstancesState()
    const settings = await this.app.registry.get(kSettings)
    const gate = getJavaReferenceGate(this.app)
    // Block stale reference edits while verifying and migrating the replacement.
    return this.app.mutex.of('java/reference-update').runExclusive(async () => {
      await gate.enter(() => {})
      try {
        const key = javaRuntimeLockKey(this.app, replacementPath, this.getPath('jre'))
        return await withJavaRuntimeLock(this.app, key, async () => {
          const { usesOldRuntime, oldRuntime, replacement } = await this.verifyJavaReplacement(replacementPath)
          const oldKey = javaRuntimeLockKey(this.app, replacement.replacesJava!, this.getPath('jre'))
          return withJavaRuntimeLock(this.app, oldKey, async () => {
            if (!await matchesJavaRuntimeIdentity(oldRuntime, replacement.replacementIdentity)) {
              this.warn(`Preserving previous Java runtime because its identity has changed or is unavailable: ${oldRuntime}`)
              return false
            }
            const old = this.state.all.find(java => java.path === replacement.replacesJava)
            if (old) {
              this.state.javaUpdate({ ...replacement, prependCommand: old.prependCommand, vmOptions: old.vmOptions })
            }
            gate.publish(() => {
              for (const instance of instances.instances) {
                if (usesOldRuntime(instance.java)) instances.instanceEdit({ path: instance.path, java: replacementPath })
              }
              if (usesOldRuntime(settings.globalJava)) settings.globalJavaSet(replacementPath)
            })
            return true
          })
        })
      } finally {
        gate.release(false)
      }
    })
  }

  /** Remove a Java record and optionally its files, guarding replacement cleanup when supplied. */
  async removeJava(javaPath: string, attemptUninstall: boolean = false, replacementPath?: string): Promise<boolean> {
    if (!replacementPath) {
      const key = javaRuntimeLockKey(this.app, javaPath, this.getPath('jre'))
      await withJavaRuntimeLock(this.app, key, () => this.removeJavaWithLock(javaPath, attemptUninstall))
      return true
    }

    await this.initialize()
    if (!attemptUninstall) {
      throw new Error('Cannot safely remove an unverified Java replacement')
    }

    const instanceService = await this.app.registry.getOrCreate(InstanceService)
    const instances = await instanceService.getSharedInstancesState()
    const settings = await this.app.registry.get(kSettings)
    const gate = getJavaReferenceGate(this.app)
    return this.app.mutex.of('java/reference-update').runExclusive(async () => {
      await gate.enter(() => {})
      try {
        const { usesOldRuntime, oldRuntime } = this.getPendingReplacement(replacementPath, javaPath)
        if (usesOldRuntime(settings.globalJava) || instances.instances.some(instance => usesOldRuntime(instance.java))) {
          throw new Error(`Cannot remove Java while launcher settings reference it: ${javaPath}`)
        }
        // Do not remove the old runtime until migrated references are durable.
        await this.flushJavaUpdate()
        const replacementKey = javaRuntimeLockKey(this.app, replacementPath, this.getPath('jre'))
        return await withJavaRuntimeLock(this.app, replacementKey, async () => {
          const { replacement } = await this.verifyJavaReplacement(replacementPath, javaPath)
          const key = javaRuntimeLockKey(this.app, javaPath, this.getPath('jre'))
          return withJavaRuntimeLock(this.app, key, async () => {
            if (!await matchesJavaRuntimeIdentity(oldRuntime, replacement.replacementIdentity)) {
              this.warn(`Preserving previous Java runtime because its identity has changed or is unavailable: ${oldRuntime}`)
              return false
            }
            await this.removeJavaWithLock(javaPath, true)
            gate.retire(oldRuntime)
            return true
          })
        })
      } finally {
        gate.release(false)
      }
    })
  }

  /** Remove the runtime under its lock, refusing to delete files used by a tracked game. */
  private async removeJavaWithLock(javaPath: string, attemptUninstall: boolean): Promise<void> {
    const key = this.removalKey(javaPath)
    this.removalGenerations.set(key, (this.removalGenerations.get(key) ?? 0) + 1)
    let removedComponent: string | undefined
    if (attemptUninstall) {
      const root = resolve(this.getPath('jre'))
      const executable = resolve(javaPath)
      const rel = relative(root, executable)

      if (
        !rel ||
        rel === '..' ||
        rel.startsWith(`..${sep}`) ||
        isAbsolute(rel) ||
        rel.split(sep).length < 2
      ) {
        this.log(`${executable} is not managed by XMCL, skipping uninstall...`)
      } else {
        removedComponent = rel.split(sep)[0]
        const launchService = await this.app.registry.getOrCreate(LaunchService)
        const processes = await launchService.getGameProcesses()
        const inUse = processes.some(({ options }) => {
          const running = getManagedJavaComponent(options.java, root)?.component
          return this.app.platform.os === 'windows'
            ? running?.toLowerCase() === removedComponent?.toLowerCase()
            : running === removedComponent
        })
        if (inUse) throw new Error(`Cannot remove Java while a game is using it: ${javaPath}`)
        const javaDir = join(root, removedComponent)
        await remove(javaDir)
        this.log(`Removed java installation at ${javaDir}`)
      }
    }

    const managedJavaPaths = removedComponent
      ? this.state.all
          .filter(
            (java) =>
              getManagedJavaComponent(java.path, this.getPath('jre'))?.component ===
              removedComponent,
          )
          .map((java) => java.path)
      : []
    const javaPaths = managedJavaPaths.length > 0 ? managedJavaPaths : [javaPath]
    for (const path of javaPaths) {
      this.state.javaRemove({ path, majorVersion: 0, version: '', valid: false })
    }
  }

  async getJavaState(): Promise<SharedState<JavaState>> {
    await this.initialize()
    return this.state
  }

  /**
   * Get java preferred java 8 for installing forge or other purpose. (non launching Minecraft)
   */
  getPreferredJava() {
    return (
      this.state.all.find((j) => j.valid && j.majorVersion === 8) ||
      this.state.all.find((j) => j.valid)
    )
  }

  async validateJavaPath(javaPath: string): Promise<JavaValidation> {
    const result = await validateJavaPath(javaPath)

    const found = this.state.all.find((java) => java.path === javaPath)
    if (found && result !== JavaValidation.Okay) {
      this.state.javaUpdate({ ...found, valid: false })
    }

    return result
  }

  /**
   * Resolve and cache Java info, optionally requiring a specific major version.
   * A timed-out version probe throws instead of marking the runtime invalid.
   */
  async resolveJava(javaPath: string, expectedMajorVersion?: number): Promise<undefined | Java> {
    requireString(javaPath)
    const key = this.removalKey(javaPath)
    const generation = this.removalGenerations.get(key)
    // A slow probe must not reintroduce a runtime removed while it was running.
    const removed = () => this.removalGenerations.get(key) !== generation

    this.log(`Try resolve java ${javaPath}`)
    const validation = await validateJavaPath(javaPath)
    if (removed()) return undefined

    const found = this.state.all.find((java) => java.path === javaPath)
    if (validation === JavaValidation.NotExisted) {
      if (found?.valid) {
        this.state.javaUpdate({ ...found, valid: false })
      }
      this.log(`Skip resolve missing java ${javaPath}`)
      return undefined
    }
    if (validation !== JavaValidation.Okay) {
      if (found?.valid) {
        this.state.javaUpdate({ ...found, valid: false })
      }
      return undefined
    }

    const diagnostic = await resolveJavaWithDiagnostic(javaPath, { timeout: JAVA_PROBE_TIMEOUT })
    if (removed()) return undefined
    if (diagnostic.timedOut) {
      throw new Error(`Java version probe timed out after ${JAVA_PROBE_TIMEOUT} ms: ${javaPath}`)
    }
    const java = diagnostic.java
    if (java) {
      if (expectedMajorVersion !== undefined && java.majorVersion !== expectedMajorVersion) {
        throw new Error(`Expected Java ${expectedMajorVersion}, but the runtime is Java ${java.majorVersion}: ${javaPath}`)
      }
      const managed = getManagedJavaComponent(java.path, this.getPath('jre'))
      const managedVersion = managed && getJavaRuntimeVersionFromName(managed.component)
      const resolved = managedVersion ? { ...java, version: managedVersion } : java
      const arch = await getJavaArch(this, java.path)
      if (removed()) return undefined
      const current = this.state.all.find((entry) => entry.path === javaPath)
      this.log(`Resolved java ${resolved.version} in ${javaPath}`)

      this.state.javaUpdate({
        ...resolved,
        valid: true,
        isInternal: !!managed && !!current?.installVendor && current.isInternal !== false,
        arch,
      })
      return resolved
    } else {
      // `resolveJava` returned nothing even though the binary exists and is
      // executable. On Linux the most common non-obvious cause is a libc
      // mismatch: a musl-linked JRE on a glibc host (or vice versa) cannot be
      // spawned — the kernel reports ENOENT for the missing dynamic loader,
      // not for the binary. Inspect the ELF interpreter directly so we can log
      // an actionable reason instead of a cryptic failure.
      if (this.app.platform.os === 'linux') {
        const exeLibc = await detectExecutableLibc(javaPath)
        const hostLibc = detectLibc()
        if (exeLibc && exeLibc !== hostLibc) {
          this.warn(
            `Java at ${javaPath} is a ${exeLibc}-linked build but this host uses ${hostLibc}; ` +
              'it cannot be launched (its dynamic loader is absent). Install a ' +
              `${hostLibc} JRE instead.`,
          )
        }
      }

      const home = dirname(dirname(javaPath))
      const releaseData = await readFile(join(home, 'release'), 'utf-8').catch(() => '')
      if (removed()) return undefined
      const javaVersion = releaseData
        .split('\n')
        .map((l) => l.split('='))
        .find((v) => v[0] === 'JAVA_VERSION')?.[1]
      if (javaVersion) {
        const parsedJavaVersion = parseJavaVersion(javaVersion)
        if (parsedJavaVersion) {
          this.log(`Resolved invalid java ${parsedJavaVersion.version} in ${javaPath}`)
          this.state.javaUpdate({ ...parsedJavaVersion, path: javaPath, valid: false })
        } else {
          this.log(`Resolved invalid unknown version java in ${javaPath}`)
          this.state.javaUpdate({ valid: false, path: javaPath, version: '', majorVersion: 0 })
        }
      } else {
        this.log(`Resolved invalid unknown version java in ${javaPath}`)
        this.state.javaUpdate({ valid: false, path: javaPath, version: '', majorVersion: 0 })
      }
    }
    return java
  }

  /**
   * scan local java locations and cache
   */
  @Singleton()
  async refreshLocalJava(force?: boolean) {
    const generations = new Map(this.removalGenerations)
    if (this.state.all.length > 0 && !force) {
      this.log(`Re-validate cached ${this.state.all.length} java locations.`)
      const javas: JavaRecord[] = []
      const visited = new Set<number>()
      for (let i = 0; i < this.state.all.length; ++i) {
        const existing = this.state.all[i]
        const ino = await stat(existing.path).then(
          (s) => s.ino,
          (e) => undefined,
        )
        if (!ino) {
          javas.push({ ...existing, valid: false })
          continue
        }
        if (visited.has(ino)) {
          continue
        }
        visited.add(ino)
        const result = await resolveJava(existing.path, { timeout: JAVA_PROBE_TIMEOUT })
        if (result) {
          const managed = getManagedJavaComponent(result.path, this.getPath('jre'))
          const managedVersion = managed && getJavaRuntimeVersionFromName(managed.component)
          javas.push({
            ...result,
            version: managedVersion ?? result.version,
            prependCommand: existing.prependCommand,
            vmOptions: existing.vmOptions,
            valid: true,
            arch: existing.arch ?? (await getJavaArch(this, result.path)),
            isInternal: !!managed && !!existing.installVendor && existing.isInternal !== false,
            installVendor: existing.installVendor,
            replacesJava: existing.replacesJava,
            replacementRuntime: existing.replacementRuntime,
            replacementIdentity: existing.replacementIdentity,
          })
        } else {
          javas.push({ ...existing, valid: false })
        }
      }
      const invalided = javas.filter((j) => !j.valid).length
      if (invalided !== 0) {
        this.log(`Invalidate ${invalided} java!`)
        for (const i of javas.filter((j) => !j.valid)) {
          this.log(i.path)
        }
      }
      this.state.javaUpdate(
        javas.filter(
          (java) =>
            generations.get(this.removalKey(java.path)) ===
            this.removalGenerations.get(this.removalKey(java.path)),
        ).map((java) => {
          const current = this.state.all.find(entry => entry.path === java.path)
          return current ? {
            ...java,
            isInternal: current.isInternal,
            installVendor: current.installVendor,
            replacesJava: current.replacesJava,
            replacementRuntime: current.replacementRuntime,
            replacementIdentity: current.replacementIdentity,
            prependCommand: current.prependCommand,
            vmOptions: current.vmOptions,
          } : java
        }),
      )
    }

    // A populated cache must not hide Java installations added since the last scan.
    this.log('Scan local Java installations.')
    const commonLocations: string[] = []
    if (this.app.platform.os === 'windows') {
      commonLocations.push(
        ...(await getMojangJavaPaths()),
        ...(await getOrcaleJavaPaths()),
        ...(await getOpenJdkPaths()),
        ...(await getAdoptiumJavaPaths()),
        ...(await getZuluJdkPath()),
      )
    } else if (this.app.platform.os === 'linux') {
      commonLocations.push(...(await getJavaPathsLinux()))
      commonLocations.push(...(await getJavaPathsLinuxSDK()))
    } else if (this.app.platform.os === 'osx') {
      commonLocations.push(...(await getJavaPathsOSX()))
    }
    const discovered = await scanLocalJava([...new Set(commonLocations)], { timeout: JAVA_PROBE_TIMEOUT })
    const existingByPath = new Map(this.state.all.map((java) => [java.path, java]))
    const uniqueDiscovered = [...new Map(discovered.map((java) => [java.path, java])).values()]

    const infos = await Promise.all(
      uniqueDiscovered.map(async (j) => {
        const existing = existingByPath.get(j.path)

        return {
          ...j,
          prependCommand: existing?.prependCommand,
          vmOptions: existing?.vmOptions,
          valid: true,
          arch: existing?.arch ?? (await getJavaArch(this, j.path)),
        }
      }),
    )
    this.log(`Found ${infos.length} java.`)
    this.state.javaUpdate(infos)

    const jreDir = this.getPath('jre')
    const cached = await readdirIfPresent(jreDir)
    const knownJavaPaths = new Set([
      ...this.state.all.map((java) => java.path),
      ...uniqueDiscovered.map((java) => java.path),
    ])
    const managedJavaResolutions: Promise<unknown>[] = []

    for (const component of cached) {
      if (component.startsWith('.')) continue

      const local = getJavaExeFilePath(join(jreDir, component), this.app.platform)

      if (!knownJavaPaths.has(local)) {
        knownJavaPaths.add(local)
        managedJavaResolutions.push(this.resolveJava(local))
      }
    }

    await Promise.all(managedJavaResolutions)
  }
}

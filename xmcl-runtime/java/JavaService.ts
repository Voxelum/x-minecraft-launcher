import { parseJavaVersion, resolveJava, scanLocalJava } from '@xmcl/installer'
import {
  JavaSchema,
  JavaServiceKey,
  JavaState,
  JavasSchema,
  type JavaService as IJavaService,
  type Java,
  type JavaRecord,
  type SharedState,
} from '@xmcl/runtime-api'
import { readFile, readJson, stat, writeJson, remove } from 'fs-extra'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import {
  JavaValidation,
  detectLibc,
  detectExecutableLibc,
  getJavaExeFilePath,
  validateJavaPath,
} from '~/java'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { LauncherApp } from '../app/LauncherApp'

import { readdirIfPresent } from '../util/fs'
import { requireString } from '../util/object'
import { ensureClass, getJavaArch } from './detectJVMArch'
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

@ExposeServiceKey(JavaServiceKey)
export class JavaService extends StatefulService<JavaState> implements IJavaService {
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
        const data = await readJson(javaJsonPath)
          .then(JavasSchema.parse)
          .catch(() => ({ all: [] }))
        const valid = data.all
          .filter((l) => typeof l.path === 'string')
          .map((a) => ({ ...a, valid: true }))
        this.log(`Loaded ${valid.length} java from cache.`)
        this.state.javaUpdate(valid)

        this.refreshLocalJava().catch((e) => this.error(e))

        this.state.subscribeAll(() => {
          const all = []
          for (const j of this.state.all) {
            const parsed = JavaSchema.safeParse(j)
            if (parsed.success) {
              all.push(parsed.data)
            } else {
              this.warn(`Invalid java schema detected for ${j.path}, skip it from cache.`)
            }
          }
          writeJson(javaJsonPath, { all }, { spaces: 2 })
        })
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

  async removeJava(javaPath: string, attemptUninstall: boolean = false): Promise<void> {
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
        const javaDir = join(root, rel.split(sep)[0])
        await remove(javaDir)
        this.log(`Removed java installation at ${javaDir}`)
      }
    }

    this.state.javaRemove({ path: javaPath, majorVersion: 0, version: '', valid: false })
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
   * Resolve java info. If the java is not known by launcher, it will cache it into the launcher java list.
   */
  async resolveJava(javaPath: string): Promise<undefined | Java> {
    requireString(javaPath)

    this.log(`Try resolve java ${javaPath}`)
    const validation = await validateJavaPath(javaPath)

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

    const java = await resolveJava(javaPath)
    if (java) {
      this.log(`Resolved java ${java.version} in ${javaPath}`)

      this.state.javaUpdate({ ...java, valid: true, arch: await getJavaArch(this, java.path) })
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
        const result = await resolveJava(existing.path)
        if (result) {
          javas.push({
            ...result,
            prependCommand: existing.prependCommand,
            vmOptions: existing.vmOptions,
            valid: true,
            arch: existing.arch ?? (await getJavaArch(this, result.path)),
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
      this.state.javaUpdate(javas)
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
    const discovered = await scanLocalJava([...new Set(commonLocations)])
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

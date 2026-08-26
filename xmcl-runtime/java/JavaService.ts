import {
  parseJavaVersion,
  resolveJava,
  scanLocalJava,
  detectLibc,
} from '@xmcl/installer'
import {
  JavaSchema,
  JavaServiceKey,
  JavaState,
  JavasSchema,
  type JavaService as IJavaService,
  type Java,
  type JavaRecord,
  type SharedState
} from '@xmcl/runtime-api'
import { readFile, readJson, stat, writeJson } from 'fs-extra'
import { dirname, join } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import {
  JavaValidation,
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
  getJavaPathsLinux,
  getJavaPathsLinuxSDK,
  getJavaPathsOSX,
  getMojangJavaPaths,
  getOpenJdkPaths,
  getOrcaleJavaPaths,
  getZuluJdkPath,
} from './javaPaths'
import { setupZuluCache } from './zulu'

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
        const data = await readJson(javaJsonPath).then(JavasSchema.parse).catch(() => ({ all: [] }))
        const valid = data.all
          .filter((l) => typeof l.path === 'string')
          .map((a) => ({ ...a, valid: true }))
        this.log(`Loaded ${valid.length} java from cache.`)
        this.state.javaUpdate(valid)

        this.refreshLocalJava()

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

        setupZuluCache(app).catch((e) => {
          this.error(e)
        })
      },
    )
  }

  removeJava(javaPath: string): Promise<void> {
    this.state.javaRemove({ path: javaPath, majorVersion: 0, version: '', valid: false })
    return Promise.resolve()
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
   * Resolve java info. If the java is not known by launcher. It will cache it into the launcher java list.
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
    if (this.state.all.length === 0 || force) {
      this.log('Force update or no local cache found. Scan java through the disk.')
      const commonLocations = [] as string[]
      if (this.app.platform.os === 'windows') {
        commonLocations.push(
          ...(await getMojangJavaPaths()),
          ...(await getOrcaleJavaPaths()),
          ...(await getOpenJdkPaths()),
          ...(await getZuluJdkPath()),
        )
      } else if (this.app.platform.os === 'linux') {
        commonLocations.push(...(await getJavaPathsLinux()))
        commonLocations.push(...(await getJavaPathsLinuxSDK()))
      } else if (this.app.platform.os === 'osx') {
        commonLocations.push(...(await getJavaPathsOSX()))
      }
      const javas = await scanLocalJava(commonLocations)
      const infos = await Promise.all(
        javas.map(async (j) => ({ ...j, valid: true, arch: await getJavaArch(this, j.path) })),
      )

      this.log(`Found ${infos.length} java.`)
      this.state.javaUpdate(infos)
    } else {
      this.log(`Re-validate cached ${this.state.all.length} java locations.`)
      const javas: JavaRecord[] = []
      const visited = new Set<number>()
      for (let i = 0; i < this.state.all.length; ++i) {
        const ino = await stat(this.state.all[i].path).then(
          (s) => s.ino,
          (e) => undefined,
        )
        if (!ino) {
          javas.push({ ...this.state.all[i], valid: false })
          continue
        }
        if (visited.has(ino)) {
          continue
        }
        visited.add(ino)
        const result = await resolveJava(this.state.all[i].path)
        if (result) {
          javas.push({
            ...result,
            valid: true,
            arch: this.state.all[i].arch ?? (await getJavaArch(this, result.path)),
          })
        } else {
          javas.push({ ...this.state.all[i], valid: false })
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

    const jreDir = this.getPath('jre')
    const cached = await readdirIfPresent(jreDir)
    for (const component of cached) {
      if (component.startsWith('.')) continue
      const local = getJavaExeFilePath(join(jreDir, component), this.app.platform)
      if (!this.state.all.map((j) => j.path).some((p) => p === local)) {
        this.resolveJava(local)
      }
    }
  }
}

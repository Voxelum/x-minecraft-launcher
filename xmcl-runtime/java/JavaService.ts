import { JavaVersion } from '@xmcl/core'
import { installJavaRuntimeWithJsonTask, parseJavaVersion, resolveJava, scanLocalJava } from '@xmcl/installer'
import { JavaService as IJavaService, Java, JavaRecord, JavaSchema, JavaServiceKey, JavaState, SharedState } from '@xmcl/runtime-api'
import { chmod, ensureFile, readFile, stat } from 'fs-extra'
import { dirname, join } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { GFW, kGFW } from '~/gfw'
import { JavaValidation, getJavaExeFilePath, validateJavaPath } from '~/java'
import { kDownloadOptions } from '~/network'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { readdirIfPresent } from '../util/fs'
import { requireString } from '../util/object'
import { SafeFile, createSafeFile } from '../util/persistance'
import { ensureClass, getJavaArch } from './detectJVMArch'
import { getJavaPathsLinux, getJavaPathsLinuxSDK, getJavaPathsOSX, getMojangJavaPaths, getOpenJdkPaths, getOrcaleJavaPaths, getZuluJdkPath } from './javaPaths'
import { getOfficialJavaManifest } from './installDefaultJava'
import { getZuluJRE, installZuluJavaTask, setupZuluCache } from './zulu'
import { FSWatcher } from 'chokidar'
import { kFlights } from '~/flights'

@ExposeServiceKey(JavaServiceKey)
export class JavaService extends StatefulService<JavaState> implements IJavaService {
  protected readonly config: SafeFile<JavaSchema>

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app, () => store.registerStatic(new JavaState(), JavaServiceKey), async () => {
      ensureClass(this.app).catch((e) => {
        this.error(e)
      })

      const data = await this.config.read()
      const valid = data.all.filter(l => typeof l.path === 'string').map(a => ({ ...a, valid: true }))
      this.log(`Loaded ${valid.length} java from cache.`)
      this.state.javaUpdate(valid)

      this.refreshLocalJava()

      this.state.subscribeAll(() => {
        this.config.write(this.state)
      })

      setupZuluCache(app).catch((e) => {
        this.error(e)
      })
    })
    this.config = createSafeFile(this.getAppDataPath('java.json'), JavaSchema, this, [getPath('java.json')])
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
    return this.state.all.find(j => j.valid && j.majorVersion === 8) || this.state.all.find(j => j.valid)
  }

  /**
   * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
   */
  @Singleton()
  async installJava(target: JavaVersion = {
    majorVersion: 8,
    component: 'jre-legacy',
  }, forceZulu = false) {
    this.log(`Try to install java ${target.component} (${target.component})`)

    const flights = await this.app.registry.get(kFlights)
    if (flights.forceZuluJre) {
      this.log('Force install zulu jre by flight')
      forceZulu = true
    }

    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    const settings = await this.app.registry.get(kSettings)
    const gfw = await this.app.registry.get(kGFW)

    let apiHost: string[] | undefined
    const apis = getApiSets(settings)
    if (shouldOverrideApiSet(settings, gfw.inside)) {
      apiHost = apis.map(a => new URL(a.url).hostname)
    }

    const officialManifest = !forceZulu
      ? await getOfficialJavaManifest(this.app, target.component).catch(() => undefined)
      : undefined

    const folder = this.getPath('jre', officialManifest ? target.component : target.component + '-zulu')
    const exeLocation = getJavaExeFilePath(folder, this.app.platform)

    if (!officialManifest) {
      // use zulu
      this.log(`Install zulu jre runtime ${target.component} (${target.majorVersion})`)
      const zuluData = await getZuluJRE(this.app, target.component as any)
      await this.submit(installZuluJavaTask(zuluData, folder, target.majorVersion, downloadOptions))
    } else {
      this.log(`Install official jre runtime ${target.component} (${target.majorVersion}) ${officialManifest.version.name}`)
      await this.submit(installJavaRuntimeWithJsonTask({
        target: officialManifest,
        destination: folder,
        ...downloadOptions,
        skipRevalidate: true,
        apiHost,
      }).setName('installJre', { version: target.majorVersion }))
    }

    if (this.app.platform.os !== 'windows') {
      await chmod(exeLocation, 0o765)
    }

    if (officialManifest) {
      this.log(`Successfully install java internally ${exeLocation}`)
    } else {

    }
    const result = await this.resolveJava(exeLocation)
    if (!result) {
      throw new AnyError('InstallDefaultJavaError', 'Fail to install java')
    }
    return result
  }

  async validateJavaPath(javaPath: string): Promise<JavaValidation> {
    const result = await validateJavaPath(javaPath)

    const found = this.state.all.find(java => java.path === javaPath)
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

    const found = this.state.all.find(java => java.path === javaPath)
    if (found) {
      if (validation !== JavaValidation.Okay) {
        // invalidate java
        if (found.valid) {
          this.state.javaUpdate({ ...found, valid: false })
        }
      } else {
        if (!found.valid) {
          this.state.javaUpdate({ ...found, valid: true })
        }
        this.log(`Found a cached & ${found.valid ? 'valid' : 'invalid'} java ${found.version} in ${javaPath}`)
      }
      return found
    }

    if (validation === JavaValidation.NotExisted) {
      // just cannot resolve java
      this.log(`Skip resolve missing java ${javaPath}`)
      return undefined
    }

    const java = await resolveJava(javaPath)
    if (java && validation === JavaValidation.Okay) {
      this.log(`Resolved java ${java.version} in ${javaPath}`)

      this.state.javaUpdate({ ...java, valid: true, arch: await getJavaArch(this, java.path) })
    } else {
      const home = dirname(dirname(javaPath))
      const releaseData = await readFile(join(home, 'release'), 'utf-8')
      const javaVersion = releaseData.split('\n').map(l => l.split('=')).find(v => (v[0] === 'JAVA_VERSION'))?.[1]
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
          ...await getMojangJavaPaths(),
          ...await getOrcaleJavaPaths(),
          ...await getOpenJdkPaths(),
          ...await getZuluJdkPath(),
        )
      } else if (this.app.platform.os === 'linux') {
        commonLocations.push(...await getJavaPathsLinux())
        commonLocations.push(...await getJavaPathsLinuxSDK())
      } else if (this.app.platform.os === 'osx') {
        commonLocations.push(...await getJavaPathsOSX())
      }
      const javas = await scanLocalJava(commonLocations)
      const infos = await Promise.all(javas.map(async (j) => ({ ...j, valid: true, arch: await getJavaArch(this, j.path) })))

      this.log(`Found ${infos.length} java.`)
      this.state.javaUpdate(infos)
    } else {
      this.log(`Re-validate cached ${this.state.all.length} java locations.`)
      const javas: JavaRecord[] = []
      const visited = new Set<number>()
      for (let i = 0; i < this.state.all.length; ++i) {
        const ino = await stat(this.state.all[i].path).then(s => s.ino, (e) => undefined)
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
          javas.push({ ...result, valid: true, arch: this.state.all[i].arch ?? await getJavaArch(this, result.path) })
        } else {
          javas.push({ ...this.state.all[i], valid: false })
        }
      }
      const invalided = javas.filter(j => !j.valid).length
      if (invalided !== 0) {
        this.log(`Invalidate ${invalided} java!`)
        for (const i of javas.filter(j => !j.valid)) {
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
      if (!this.state.all.map(j => j.path).some(p => p === local)) {
        this.resolveJava(local)
      }
    }
  }
}

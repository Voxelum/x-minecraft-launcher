import { JavaVersion } from '@xmcl/core'
import { fetchJavaRuntimeManifest, installJavaRuntimesTask, parseJavaVersion, resolveJava, scanLocalJava } from '@xmcl/installer'
import { Java, JavaRecord, JavaSchema, JavaService as IJavaService, JavaServiceKey, JavaState } from '@xmcl/runtime-api'
import { requireObject, requireString } from '@xmcl/runtime-api/utils'
import { access, chmod, constants, ensureFile, readFile } from 'fs-extra'
import { dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { missing, readdirIfPresent } from '../util/fs'
import { createSafeFile } from '../util/persistance'
import DiagnoseService from './DiagnoseService'
import { ExportService, Inject, Singleton, StatefulService } from './Service'

@ExportService(JavaServiceKey)
export default class JavaService extends StatefulService<JavaState> implements IJavaService {
  protected readonly config = createSafeFile(this.getPath('java.json'), JavaSchema, this)

  constructor(app: LauncherApp,
    @Inject(DiagnoseService) diagnoseService: DiagnoseService) {
    super(app, async () => {
      const data = await this.config.read()
      const valid = data.all.filter(l => typeof l.path === 'string').map(a => ({ ...a, valid: true }))
      this.log(`Loaded ${valid.length} java from cache.`)
      this.state.javaUpdate(valid)

      const local = this.getInternalJavaLocation({ majorVersion: 8, component: 'jre-legacy' })
      if (!this.state.all.map(j => j.path).some(p => p === local)) {
        this.validateJava(local)
      }
      const localAlpha = this.getInternalJavaLocation({ majorVersion: 16, component: 'java-runtime-alpha' })
      if (!this.state.all.map(j => j.path).some(p => p === localAlpha)) {
        this.validateJava(local)
      }
      this.refreshLocalJava()

      this.storeManager.subscribeAll(['javaUpdate', 'javaRemove'], () => {
        this.config.write(this.state)
      })
    })

    diagnoseService.registerMatchedFix(['missingJava'], (issue) => {
      const missingJavaIssue = issue[0].parameters as any
      if (missingJavaIssue.targetVersion) {
        this.installDefaultJava(missingJavaIssue.targetVersion)
      }
    })
  }

  createState() { return new JavaState() }

  getInternalJavaLocation(version: JavaVersion) {
    return this.app.platform.name === 'osx'
      ? this.getPath('jre', version.component, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
      : this.getPath('jre', version.component, 'bin',
        this.app.platform.name === 'windows' ? 'java.exe' : 'java')
  }

  getJavaForVersion(javaVersion: JavaVersion, validOnly = false) {
    const expectedJava = this.state.all.find(j => j.majorVersion === javaVersion.majorVersion && (!validOnly || j.valid))
    return expectedJava
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
  async installDefaultJava(target: JavaVersion) {
    requireObject(target)

    const location = this.getInternalJavaLocation(target)
    this.log(`Try to install official java ${target} to ${location}`)
    // if (this.state.all.find(j => j.path === location)) {
    //   return
    // }
    const manifest = await fetchJavaRuntimeManifest({
      apiHost: this.networkManager.isInGFW ? 'bmclapi2.bangbang93.com' : undefined,
      ...this.networkManager.getDownloadBaseOptions(),
      target: target.component,
    })
    this.log(`Install jre runtime ${target.component} (${target.majorVersion}) ${manifest.version.name} ${manifest.version.released}`)
    const dest = this.getPath('jre', target.component)
    const task = installJavaRuntimesTask({
      manifest,
      apiHost: this.networkManager.isInGFW ? 'bmclapi2.bangbang93.com' : undefined,
      destination: dest,
      ...this.networkManager.getDownloadBaseOptions(),
    }).setName('installJre')
    await ensureFile(location)
    await this.submit(task)
    if (this.app.platform.name !== 'windows') {
      await chmod(location, 0o765)
    }
    this.log(`Successfully install java internally ${location}`)
    return await this.resolveJava(location)
  }

  /**
   * Resolve java info. If the java is not known by launcher. It will cache it into the launcher java list.
   */
  async resolveJava(javaPath: string): Promise<undefined | Java> {
    requireString(javaPath)

    this.log(`Resolve java ${javaPath}`)

    const found = this.state.all.find(java => java.path === javaPath)
    if (found) {
      this.log(`Found in memory ${found.valid ? 'valid' : 'invalid'} java ${found.version} in ${javaPath}`)
      return found
    }

    if (await missing(javaPath)) {
      this.log(`Skip for missing java ${javaPath}`)
      return undefined
    }

    return this.validateJava(javaPath)
  }

  async validateJava(javaPath: string) {
    const java = await resolveJava(javaPath)
    if (java) {
      this.log(`Resolved java ${java.version} in ${javaPath}`)
      if (this.app.platform.name !== 'windows') {
        try {
          await access(javaPath, constants.X_OK)
        } catch (e) {
          await chmod(javaPath, 0o765)
        }
      }
      this.state.javaUpdate({ ...java, valid: true })
    } else {
      if (await missing(javaPath)) {
        return
      }
      if (this.app.platform.name !== 'windows') {
        try {
          await access(javaPath, constants.X_OK)
        } catch (e) {
          await chmod(javaPath, 0o765)
        }
      }
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
      if (this.app.platform.name === 'windows') {
        let files = await readdirIfPresent('C:\\Program Files\\Java')
        files = files.map(f => join('C:\\Program Files\\Java', f, 'bin', 'java.exe'))
        commonLocations.push(...files)
      }
      const javas = await scanLocalJava(commonLocations)
      const infos = javas.map(j => ({ ...j, valid: true }))

      this.log(`Found ${infos.length} java.`)
      this.state.javaUpdate(infos)

      const local = this.getInternalJavaLocation({ majorVersion: 8, component: 'jre-legacy' })
      if (!this.state.all.map(j => j.path).some(p => p === local)) {
        this.validateJava(local)
      }
      const localAlpha = this.getInternalJavaLocation({ majorVersion: 16, component: 'java-runtime-alpha' })
      if (!this.state.all.map(j => j.path).some(p => p === localAlpha)) {
        this.validateJava(local)
      }
    } else {
      this.log(`Re-validate cached ${this.state.all.length} java locations.`)
      const javas: JavaRecord[] = []
      for (let i = 0; i < this.state.all.length; ++i) {
        const result = await resolveJava(this.state.all[i].path)
        if (result) {
          javas.push({ ...result, valid: true })
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
  }
}

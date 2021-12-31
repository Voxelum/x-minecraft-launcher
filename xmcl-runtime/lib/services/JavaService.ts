import { JavaVersion } from '@xmcl/core'
import { DownloadTask, fetchJavaRuntimeManifest, installJavaRuntimesTask, parseJavaVersion, resolveJava, scanLocalJava, UnzipTask } from '@xmcl/installer'
import { Java, JavaRecord, JavaSchema, JavaService as IJavaService, JavaServiceKey, JavaState } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { open, readAllEntries } from '@xmcl/unzip'
import { ensureFile, move, readdir, readFile, remove, unlink } from 'fs-extra'
import { basename, dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { getTsingHuaAdpotOponJDKPageUrl, parseTsingHuaAdpotOpenJDKHotspotArchive } from '../entities/java'
import { missing, readdirIfPresent } from '../util/fs'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import { unpack7z } from '../util/zip'
import DiagnoseService from './DiagnoseService'
import { ExportService, Inject, Singleton, StatefulService } from './Service'
import { requireString } from '/@shared/util/assert'

@ExportService(JavaServiceKey)
export default class JavaService extends StatefulService<JavaState> implements IJavaService {
  createState() { return new JavaState() }

  protected readonly config = new MappedFile<JavaSchema>(this.getPath('java.json'), new BufferJsonSerializer(JavaSchema))

  constructor(app: LauncherApp,
    @Inject(DiagnoseService) diagnoseService: DiagnoseService) {
    super(app)

    diagnoseService.registerMatchedFix(['missingJava'], (issue) => {
      const version = (issue[0].parameters as any).targetVersion
      this.installDefaultJava(version)
    })
  }

  getInternalJavaLocation(version: JavaVersion) {
    return this.app.platform.name === 'osx'
      ? this.getPath('jre', version.component, 'Contents', 'Home', 'bin', 'java')
      : this.getPath('jre', version.component, 'bin',
        this.app.platform.name === 'windows' ? 'java.exe' : 'java')
  }

  async initialize() {
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
  }

  /**
   * Install a default jdk 8 to the a preserved location. It'll be installed under your launcher root location `jre` folder
   */
  @Singleton()
  async installDefaultJava(target: JavaVersion) {
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
    const dest = dirname(dirname(location))
    const task = installJavaRuntimesTask({
      manifest,
      apiHost: this.networkManager.isInGFW ? 'bmclapi2.bangbang93.com' : undefined,
      destination: dest,
      // lzma: (src) => extractLzma(src),
      ...this.networkManager.getDownloadBaseOptions(),
    }).setName('installJre')
    await ensureFile(location)
    await this.submit(task)
    this.log(`Successfully install java internally ${location}`)
    await this.resolveJava(location)
  }

  private installFromTsingHuaTask(java: '8' | '9' | '11' | '12' | '13' | '14' | '15' | '16') {
    const { app, networkManager, log, getTempPath, state, getPath } = this
    return task('installJre', async function () {
      const system = app.platform.name === 'osx' ? 'mac' as const : app.platform.name
      const arch = app.platform.arch === 'x64' ? '64' as const : '32' as const

      const baseUrl = getTsingHuaAdpotOponJDKPageUrl(system, arch, java)
      const htmlText = await networkManager.request.get(baseUrl).text()
      const archiveInfo = parseTsingHuaAdpotOpenJDKHotspotArchive(htmlText, baseUrl)

      if (!archiveInfo) {
        throw new Error(`Cannot find jre from tsinghua mirror for ${system} x${arch}`)
      }

      const destination = getPath('jre')
      const archivePath = getTempPath(archiveInfo.fileName)
      const url = archiveInfo.url

      log(`Install jre for ${system} x${arch} from tsinghua mirror ${url}`)
      await this.yield(new DownloadTask({
        ...networkManager.getDownloadBaseOptions(),
        destination: archivePath,
        url,
      }).setName('download') /* , 90 */)

      if (system === 'windows') {
        const zip = await open(archivePath)
        const entries = await readAllEntries(zip)
        await this.yield(new UnzipTask(zip, entries.filter(e => e.fileName.startsWith('jdk8u')), destination, (entry) => {
          const [first] = entry.fileName.split('/')
          return entry.fileName.substring(first.length)
        }).setName('decompress'))
      } else {
        await this.yield(task('decompress', async () => {
          const tarPath = join(dirname(destination), basename(archivePath, '.gz'))
          // unpack gz tar to tar
          await unpack7z(archivePath, dirname(destination))

          const dirPath = join(dirname(destination), basename(archivePath, '.tar.gz'))
          // unpack tar to dir
          await unpack7z(tarPath, dirPath)

          const files = await readdir(dirPath)
          if (files[0] && files[0].startsWith('jdk8')) {
            await move(join(dirPath, files[0]), destination)
          } else {
            await move(dirPath, destination)
          }
          await Promise.all([remove(dirPath), unlink(tarPath), unlink(archivePath)])
        }))
      }
      log('Install jre for from tsing hua mirror success!')
    })
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
      this.state.javaUpdate({ ...java, valid: true })
    } else {
      if (await missing(javaPath)) {
        return
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

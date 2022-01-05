import { DownloadTask, resolveJava, scanLocalJava, UnzipTask, installJavaRuntimesTask, fetchJavaRuntimeManifest, JavaRuntimeTargetType, parseJavaVersion } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { open, readAllEntries } from '@xmcl/unzip'
import { ensureFile, move, readdir, readFile, remove, unlink } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import DiagnoseService from './DiagnoseService'
import { ExportService, Inject, Singleton, StatefulService } from './Service'
import LauncherApp from '/@main/app/LauncherApp'
import { getTsingHuaAdpotOponJDKPageUrl, parseTsingHuaAdpotOpenJDKHotspotArchive } from '/@main/entities/java'
import { missing, readdirIfPresent } from '/@main/util/fs'
import { extractLzma, unpack7z } from '/@main/util/zip'
import { JavaRecord } from '/@shared/entities/java'
import { Java, JavaSchema } from '/@shared/entities/java.schema'
import { JavaState, JavaService as IJavaService, JavaServiceKey } from '/@shared/services/JavaService'
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

  getInternalJavaLocation(version: '8' | '16') {
    const parent = version === '8' ? 'jre' : 'jre-next'
    return this.app.platform.name === 'osx'
      ? this.getPath(parent, 'Contents', 'Home', 'bin', 'java')
      : this.getPath(parent, 'bin',
        this.app.platform.name === 'windows' ? 'java.exe' : 'java')
  }

  async initialize() {
    const data = await this.config.read()
    const valid = data.all.filter(l => typeof l.path === 'string').map(a => ({ ...a, valid: true }))
    this.log(`Loaded ${valid.length} java from cache.`)
    this.state.javaUpdate(valid)

    const local = this.getInternalJavaLocation('8')
    if (!this.state.all.map(j => j.path).some(p => p === local)) {
      this.resolveJava(local)
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
  async installDefaultJava(target: '8' | '16' = '8') {
    const location = this.getInternalJavaLocation(target)
    // if (this.state.all.find(j => j.path === location)) {
    //   return
    // }
    const jreTarget = target === '16' ? JavaRuntimeTargetType.Next : JavaRuntimeTargetType.Legacy
    const manifest = await fetchJavaRuntimeManifest({
      apiHost: this.networkManager.isInGFW ? 'bmclapi2.bangbang93.com' : undefined,
      ...this.networkManager.getDownloadBaseOptions(),
      target: jreTarget,
    })
    this.log(`Install jre runtime ${jreTarget} ${manifest.version.name} ${manifest.version.released}`)
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

    const found = this.state.all.find(java => java.path === javaPath)
    if (found) {
      return found
    }

    if (await missing(javaPath)) return undefined

    const java = await resolveJava(javaPath)
    if (java) {
      this.state.javaUpdate({ ...java, valid: true })
    } else {
      const home = dirname(dirname(javaPath))
      const releaseData = await readFile(join(home, 'release'), 'utf-8')
      const javaVersion = releaseData.split('\n').map(l => l.split('=')).find(v => (v[0] === 'JAVA_VERSION'))?.[1]
      if (javaVersion) {
        const parsedJavaVersion = parseJavaVersion(javaVersion)
        if (parsedJavaVersion) {
          this.state.javaUpdate({ ...parsedJavaVersion, path: javaPath, valid: false })
        } else {
          this.state.javaUpdate({ valid: false, path: javaPath, version: '', majorVersion: 0 })
        }
      } else {
        this.state.javaUpdate({ valid: false, path: javaPath, version: '', majorVersion: 0 })
      }
    }
    return java
  }

  /**
   * scan local java locations and cache
   */
  @Singleton()
  async refreshLocalJava() {
    if (this.state.all.length === 0) {
      this.log('No local cache found. Scan java through the disk.')
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

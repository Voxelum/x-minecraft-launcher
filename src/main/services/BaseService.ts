import { copy, copyFile, ensureDir, readJson, remove, unlink, writeJson } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import AbstractService, { ExportService, Singleton } from './Service'
import { IS_DEV } from '/@main/constant'
import { SettingSchema } from '/@shared/entities/setting.schema'
import { BaseService as IBaseService, BaseServiceKey, MigrateOptions } from '/@shared/services/BaseService'

@ExportService(BaseServiceKey)
export default class BaseService extends AbstractService implements IBaseService {
  private settingFile = new MappedFile<SettingSchema>(this.getPath('setting.json'), new BufferJsonSerializer(SettingSchema))

  constructor(app: LauncherApp) {
    super(app)
    this.storeManager.subscribeAll([
      'locale',
      'allowPrerelease',
      'autoInstallOnAppQuit',
      'autoDownload',
      'apiSetsPreference',
      'apiSets',
    ], () => {
      this.settingFile.write({
        locale: this.state.base.locale,
        autoInstallOnAppQuit: this.state.base.autoInstallOnAppQuit,
        autoDownload: this.state.base.autoDownload,
        allowPrerelease: this.state.base.allowPrerelease,
        apiSets: this.state.base.apiSets,
        apiSetsPreference: this.state.base.apiSetsPreference,
      })
    })
  }

  async initialize() {
    const data = await this.settingFile.read()
    this.commit('config', {
      locale: data.locale,
      autoInstallOnAppQuit: data.autoInstallOnAppQuit,
      autoDownload: data.autoDownload,
      allowPrerelease: data.allowPrerelease,
      apiSets: data.apiSets,
      apiSetsPreference: data.apiSetsPreference,
    })
    this.checkUpdate()
  }

  async handleUrl(url: string) {
    this.app.handleUrl(url)
  }

  /**
   * Try to open a url in default browser. It will popup a message dialog to let user know.
   * If user does not trust the url, it won't open the site.
   * @param url The pending url
   */
  openInBrowser = this.app.openInBrowser.bind(this.app)

  /**
   * A electron provided function to show item in direcotry
   * @param path The path to the file item
   */
  showItemInDirectory = this.app.showItemInFolder

  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory = this.app.openDirectory

  /**
   * Quit and install the update once the update is ready
   */
  async quitAndInstall() {
    if (this.state.base.updateStatus === 'ready') {
      await this.app.installUpdateAndQuit()
    } else {
      this.warn('There is no update avaiable!')
    }
  }

  /**
   * Check launcher update.
   */
  @Singleton()
  async checkUpdate() {
    if (IS_DEV) return
    try {
      this.log('Check update')
      const info = await this.submit(this.app.checkUpdateTask())
      this.commit('updateInfo', info)
    } catch (e) {
      this.error('Check update failed')
      this.error(e)
      throw e
    }
  }

  /**
   * Download the update if there is avaiable update
   */
  @Singleton()
  async downloadUpdate() {
    if (!this.state.base.updateInfo) {
      throw new Error('Cannot download update if we don\'t check the version update!')
    }
    this.log(`Start to download update: ${this.state.base.updateInfo.version} incremental=${this.state.base.updateInfo.incremental}`)
    await this.submit(this.app.downloadUpdateTask().setName('downloadUpdate'))
    this.commit('updateStatus', 'ready')
  }

  quit = this.app.quit.bind(this.app)

  exit = this.app.exit

  private oldMigratedRoot = ''

  async migrate(options: MigrateOptions) {
    // TODO: not to hardcode

    const source = this.app.gameDataPath
    const destination = options.destination
    await ensureDir(destination)

    function onError(e: any) {
      if (e.code === 'ENOENT') return
      throw e
    }

    try {
      await Promise.all([
        copy(this.getPath('assets'), join(destination, 'assets')).catch(onError),
        copy(this.getPath('libraries'), join(destination, 'libraries')).catch(onError),
        copy(this.getPath('instances'), join(destination, 'instances')).catch(onError),
        copy(this.getPath('versions'), join(destination, 'versions')).catch(onError),
        copy(this.getPath('mods'), join(destination, 'mods')).catch(onError),
        copy(this.getPath('resourcepacks'), join(destination, 'resourcepacks')).catch(onError),
        copy(this.getPath('saves'), join(destination, 'saves')).catch(onError),
        copy(this.getPath('modpacks'), join(destination, 'modpacks')).catch(onError),

        copyFile(this.getPath('instances.json'), join(destination, 'instances.json')).catch(onError),
        copyFile(this.getPath('minecraft-versions.json'), join(destination, 'minecraft-versions.json')).catch(onError),
        copyFile(this.getPath('forge-versions.json'), join(destination, 'forge-versions.json')).catch(onError),
        copyFile(this.getPath('lite-versions.json'), join(destination, 'lite-versions.json')).catch(onError),
        copyFile(this.getPath('fabric-versions.json'), join(destination, 'fabric-versions.json')).catch(onError),
        copyFile(this.getPath('authlib-injection.json'), join(destination, 'authlib-injection.json')).catch(onError),
        copyFile(this.getPath('java.json'), join(destination, 'java.json')).catch(onError),
        copyFile(this.getPath('setting.json'), join(destination, 'setting.json')).catch(onError),
        copyFile(this.getPath('user.json'), join(destination, 'user.json')).catch(onError),
      ])

      const content = await readJson(join(destination, 'instances.json'))
      content.instances = content.instances.map((p: string) => (p.startsWith(source) ? (destination + p.substring(source.length)) : p))
      content.instance = content.selectedInstance.startsWith(source) ? (destination + content.selectedInstance.substring(source.length)) : content.selectedInstance
      await writeJson(join(destination, 'instances.json'), content)
    } catch (e) {
      this.error('Fail to migrate the root! abort!')
      this.error(e)
      throw e
    }

    try {
      this.oldMigratedRoot = this.app.gameDataPath
      await this.app.migrateRoot(destination)
      this.commit('root', destination)
    } catch (e) {
      this.oldMigratedRoot = ''
      throw e
    }
  }

  async postMigrate() {
    if (!this.oldMigratedRoot) {
      this.warn('Cannot perform post migrate as the migration is not performed or failed')
      return
    }
    await this.serviceManager.dispose()

    function onError(e: any) {
      if (e.code === 'ENOENT') return
      throw e
    }

    await Promise.all([
      remove(join(this.oldMigratedRoot, 'assets')).catch(onError),
      remove(join(this.oldMigratedRoot, 'libraries')).catch(onError),
      remove(join(this.oldMigratedRoot, 'instances')).catch(onError),
      remove(join(this.oldMigratedRoot, 'versions')).catch(onError),
      remove(join(this.oldMigratedRoot, 'mods')).catch(onError),
      remove(join(this.oldMigratedRoot, 'resourcepacks')).catch(onError),
      remove(join(this.oldMigratedRoot, 'saves')).catch(onError),
      remove(join(this.oldMigratedRoot, 'modpacks')).catch(onError),

      unlink(join(this.oldMigratedRoot, 'instances.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'minecraft-versions.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'forge-versions.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'lite-versions.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'fabric-versions.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'authlib-injection.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'java.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'setting.json')).catch(onError),
      unlink(join(this.oldMigratedRoot, 'user.json')).catch(onError),
    ])
    this.app.relaunch()
  }
}

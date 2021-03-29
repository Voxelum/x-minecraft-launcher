import { SettingSchema } from '/@shared/entities/setting.schema'
import { UpdateInfo } from '/@shared/entities/update'
import { ModuleOption } from '../root'

interface State extends SettingSchema {
  /**
   * All supported languages of the launcher
   */
  locales: string[]
  updateInfo: UpdateInfo | null
  updateStatus: 'ready' | 'none' | 'pending'
  version: string
  build: number
  /**
    * launcher root data folder path
    */
  root: string
  /**
   * Is current environment connecting to internet?
   */
  online: boolean
  /**
   * The current operating system platform
   */
  platform: NodeJS.Platform
  /**
   * The version of the launcher
   */
  launcherVersion: string
}

interface Mutations {
  config: SettingSchema
  locale: string
  locales: string[]
  allowPrerelease: boolean
  autoInstallOnAppQuit: boolean
  updateStatus: 'ready' | 'none' | 'pending'
  autoDownload: boolean
  updateInfo: UpdateInfo
  settings: { [key: string]: number | string | boolean | object }

  apiSetsPreference: 'mojang' | 'bmcl' | 'mcbbs'
  apiSets: { name: string; url: string }[]

  version: [string, number]

  root: string
  online: boolean
  launcherVersion: string
  platform: NodeJS.Platform
}

/**
 * Base Launcher Information
 */
export type BaseModule = ModuleOption<State, {}, Mutations, {}>

const mod: BaseModule = {
  state: {
    locale: '',
    locales: [],
    updateInfo: null,
    updateStatus: 'none',
    allowPrerelease: false,
    autoInstallOnAppQuit: false,
    autoDownload: false,
    apiSetsPreference: 'mcbbs',
    apiSets: [{ name: 'mcbbs', url: 'https://download.mcbbs.net' }, { name: 'bmcl', url: 'https://bmclapi2.bangbang93.com' }],
    version: '',
    build: 0,
    root: '',
    launcherVersion: '',
    online: false,
    platform: 'win32',
  },
  mutations: {
    online(state, o) { state.online = o },
    root(state, r) { state.root = r },
    platform(state, p) { state.platform = p },
    launcherVersion(state, s) { state.launcherVersion = s },
    updateInfo(state, updateInfo) {
      if (typeof updateInfo === 'object') state.updateInfo = updateInfo
    },
    updateStatus(state, updateStatus) { state.updateStatus = updateStatus },
    allowPrerelease(state, allowPrerelease) {
      if (typeof allowPrerelease === 'boolean') { state.allowPrerelease = allowPrerelease }
    },
    autoInstallOnAppQuit(state, autoInstallOnAppQuit) {
      if (typeof autoInstallOnAppQuit === 'boolean') state.autoInstallOnAppQuit = autoInstallOnAppQuit
    },
    autoDownload(state, autoDownload) {
      if (typeof autoDownload === 'boolean') state.autoDownload = autoDownload
    },
    locale(state, language) {
      state.locale = language
    },
    locales(state, languages) {
      state.locales = languages
    },
    config(state, config) {
      state.locale = config.locale
      state.autoDownload = config.autoDownload || false
      state.autoInstallOnAppQuit = config.autoDownload || false
      state.allowPrerelease = config.allowPrerelease || false
      state.apiSetsPreference = typeof config.apiSetsPreference === 'string' ? config.apiSetsPreference : 'mcbbs'
    },
    settings(state, settings) {
      // Object.assign(state.settings, settings);
    },
    apiSetsPreference(state, use) { state.apiSetsPreference = use },
    apiSets(state, sets) { state.apiSets = sets },
    version(state, [version, build]) { state.version = version; state.build = build ?? 0 },
  },
}

export default mod

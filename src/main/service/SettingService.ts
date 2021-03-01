import LauncherApp from '/@main/app/LauncherApp'
import { SettingSchema } from '/@shared/entities/setting.schema'
import Service, { MutationTrigger } from './Service'

export default class SettingService extends Service {
  constructor (app: LauncherApp) {
    super(app)
    this.persistManager.registerStoreJsonSerializable(this.getPath('setting.json'), SettingSchema, (data) => this.commit('config', {
      locale: data.locale,
      autoInstallOnAppQuit: data.autoInstallOnAppQuit,
      autoDownload: data.autoDownload,
      allowPrerelease: data.allowPrerelease,
      apiSets: data.apiSets,
      apiSetsPreference: data.apiSetsPreference
    }), () => ({
      locale: this.state.setting.locale,
      autoInstallOnAppQuit: this.state.setting.autoInstallOnAppQuit,
      autoDownload: this.state.setting.autoDownload,
      allowPrerelease: this.state.setting.allowPrerelease,
      apiSets: this.state.setting.apiSets,
      apiSetsPreference: this.state.setting.apiSetsPreference
    }), [
      'locale',
      'allowPrerelease',
      'autoInstallOnAppQuit',
      'autoDownload',
      'apiSetsPreference',
      'apiSets'
    ])
  }
}

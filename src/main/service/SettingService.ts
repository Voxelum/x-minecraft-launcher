import { SettingSchema } from '@universal/store/modules/setting.schema';
import Service, { MutationTrigger } from './Service';

export default class SettingService extends Service {
    async load() {
        const data: SettingSchema = await this.getPersistence({ path: this.getPath('setting.json'), schema: SettingSchema }) || {};
        this.commit('config', {
            locale: data.locale,
            locales: ['en', 'zh-CN'],
            autoInstallOnAppQuit: data.autoInstallOnAppQuit,
            autoDownload: data.autoDownload,
            allowPrerelease: data.allowPrerelease,
            apiSets: data.apiSets,
            apiSetsPreference: data.apiSetsPreference,
        });
    }

    @MutationTrigger(
        'locale',
        'allowPrerelease',
        'autoInstallOnAppQuit',
        'autoDownload',
        'apiSetsPreference',
        'apiSets',
    )
    private async onSettingMutation() {
        await this.setPersistence({
            path: this.getPath('setting.json'),
            data: {
                locale: this.state.setting.locale,
                autoInstallOnAppQuit: this.state.setting.autoInstallOnAppQuit,
                autoDownload: this.state.setting.autoDownload,
                allowPrerelease: this.state.setting.allowPrerelease,
                apiSets: this.state.setting.apiSets,
                apiSetsPreference: this.state.setting.apiSetsPreference,
            },
            schema: SettingSchema,
        });
    }
}

import { getPersistence, setPersistence } from 'main/utils/persistence';
import { SettingSchema } from 'universal/store/modules/setting.schema';
import Service, { MutationTrigger } from './Service';

export default class SettingService extends Service {
    async load() {
        const data: SettingSchema = await getPersistence({ path: this.getPath('setting.json'), schema: SettingSchema }) || {};
        this.commit('config', {
            locale: data.locale,
            locales: ['en', 'zh-CN'],
            autoInstallOnAppQuit: data.autoInstallOnAppQuit,
            autoDownload: data.autoDownload,
            allowPrerelease: data.allowPrerelease,
            useBmclAPI: data.useBmclAPI,
            defaultBackgroundImage: data.defaultBackgroundImage,
            defaultBlur: data.defaultBlur,
            particleMode: data.particleMode,
            showParticle: data.showParticle,
            // settings: data.settings,
        });
    }

    @MutationTrigger(
        'locale',
        'allowPrerelease',
        'autoInstallOnAppQuit',
        'autoDownload',
        'defaultBackgroundImage',
        'defaultBlur',
        'showParticle',
        'particleMode',
        'useBmclApi',
    )
    async onSettingMutation() {
        await setPersistence({
            path: this.getPath('setting.json'),
            data: {
                locale: this.state.setting.locale,
                autoInstallOnAppQuit: this.state.setting.autoInstallOnAppQuit,
                autoDownload: this.state.setting.autoDownload,
                allowPrerelease: this.state.setting.allowPrerelease,
                useBmclAPI: this.state.setting.useBmclAPI,
                defaultBackgroundImage: this.state.setting.defaultBackgroundImage,
                defaultBlur: this.state.setting.defaultBlur,
                showParticle: this.state.setting.showParticle,
                particleMode: this.state.setting.particleMode,
            },
            schema: SettingSchema,
        });
    }
}

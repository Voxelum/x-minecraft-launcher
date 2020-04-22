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
            useBmclAPI: data.useBmclAPI,
            defaultBackgroundImage: data.defaultBackgroundImage,
            defaultBlur: data.defaultBlur,
            particleMode: data.particleMode,
            showParticle: data.showParticle,
            roots: data.roots,
            primaryRoot: data.primaryRoot,
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
    private async onSettingMutation() {
        await this.setPersistence({
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
                roots: this.state.setting.roots,
                primaryRoot: this.state.setting.primaryRoot,
            },
            schema: SettingSchema,
        });
    }
}

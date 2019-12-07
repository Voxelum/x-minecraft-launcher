import { getPersistence, setPersistence } from 'main/utils/persistence';
import locales from 'static/locales';
import Service from './Service';

export default class SettingService extends Service {
    async load() {
        const data = await getPersistence({ path: this.getPath('setting.json'), schema: 'SettingConfig' }) || {};
        this.commit('config', {
            locale: data.locale,
            locales: Object.keys(locales),
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

    async save({ mutation }: { mutation: string }) {
        switch (mutation) {
            case 'locale':
            case 'allowPrerelease':
            case 'autoInstallOnAppQuit':
            case 'autoDownload':
            case 'defaultBackgroundImage':
            case 'defaultBlur':
            case 'showParticle':
            case 'particleMode':
            case 'useBmclApi':
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
                });
                break;
            default:
        }
    }
}

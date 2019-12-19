import { UpdateInfo } from 'electron-updater';
import { ModuleOption } from '../root';
import { ParticleMode, SettingSchema } from './setting.schema';

interface State extends SettingSchema {
    /**
     * All supported languages of the launcher
     */
    locales: string[];
    updateInfo: UpdateInfo | null;
    readyToUpdate: boolean;
    checkingUpdate: boolean;
    downloadingUpdate: boolean;
}

interface Mutations {
    config: SettingSchema & { locales: string[] };
    locale: string;
    allowPrerelease: boolean;
    autoInstallOnAppQuit: boolean;
    readyToUpdate: boolean;
    autoDownload: boolean;
    updateInfo: UpdateInfo;
    downloadingUpdate: boolean;
    checkingUpdate: boolean;
    settings: { [key: string]: number | string | boolean | object };
    defaultBackgroundImage: string | null;
    defaultBlur: number;
    useBmclApi: boolean;
    showParticle: boolean;
    particleMode: ParticleMode;
}


export type SettingModule = ModuleOption<State, {}, Mutations, {}>;

const mod: SettingModule = {
    state: {
        locale: '',
        locales: [],
        updateInfo: null,
        readyToUpdate: false,
        allowPrerelease: false,
        autoInstallOnAppQuit: false,
        downloadingUpdate: false,
        checkingUpdate: false,
        autoDownload: false,
        defaultBackgroundImage: null,
        defaultBlur: 0,
        useBmclAPI: true,
        showParticle: false,
        particleMode: ParticleMode.REPULSE,
    },
    mutations: {
        downloadingUpdate(state, d) { state.downloadingUpdate = !!d; },
        checkingUpdate(state, d) { state.checkingUpdate = !!d; },
        updateInfo(state, updateInfo) {
            if (typeof updateInfo === 'object') state.updateInfo = updateInfo;
        },
        readyToUpdate(state, readyToUpdate) { state.readyToUpdate = readyToUpdate; },
        allowPrerelease(state, allowPrerelease) {
            if (typeof allowPrerelease === 'boolean') { state.allowPrerelease = allowPrerelease; }
        },
        autoInstallOnAppQuit(state, autoInstallOnAppQuit) {
            if (typeof autoInstallOnAppQuit === 'boolean') state.autoInstallOnAppQuit = autoInstallOnAppQuit;
        },
        autoDownload(state, autoDownload) {
            if (typeof autoDownload === 'boolean') state.autoDownload = autoDownload;
        },
        locale(state, language) {
            state.locale = language;
        },
        config(state, config) {
            state.locale = config.locale;
            state.locales = config.locales;
            state.autoDownload = config.autoDownload || false;
            state.autoInstallOnAppQuit = config.autoDownload || false;
            state.allowPrerelease = config.allowPrerelease || false;
            state.useBmclAPI = typeof config.useBmclAPI === 'boolean' ? config.useBmclAPI : true;
            state.showParticle = config.showParticle;
            state.particleMode = config.particleMode;
        },
        settings(state, settings) {
            // Object.assign(state.settings, settings);
        },
        defaultBackgroundImage(state, img) {
            if (typeof img === 'string') state.defaultBackgroundImage = img;
        },
        defaultBlur(state, blur) {
            if (typeof blur === 'number') state.defaultBlur = blur;
        },
        useBmclApi(state, use) { state.useBmclAPI = use; },
        showParticle(state, v) { state.showParticle = v; },
        particleMode(state, v) { state.particleMode = v; },
    },
};

export default mod;
export { ParticleMode };

import { UpdateInfo } from 'electron-updater';
import { ModuleOption } from '../root';
import { SettingSchema } from './setting.schema';

interface State extends SettingSchema {
    /**
     * All supported languages of the launcher
     */
    locales: string[];
    updateInfo: UpdateInfo | null;
    readyToUpdate: 'asar' | 'full' | 'none';
    checkingUpdate: boolean;
    downloadingUpdate: boolean;
}

interface Mutations {
    config: SettingSchema & { locales: string[] };
    locale: string;
    allowPrerelease: boolean;
    autoInstallOnAppQuit: boolean;
    readyToUpdate: 'asar' | 'full' | 'none';
    autoDownload: boolean;
    updateInfo: UpdateInfo;
    downloadingUpdate: boolean;
    checkingUpdate: boolean;
    settings: { [key: string]: number | string | boolean | object };
    useBmclApi: boolean;
}


/**
 * Whole launcher setting
 */
export type SettingModule = ModuleOption<State, {}, Mutations, {}>;

const mod: SettingModule = {
    state: {
        roots: [],
        primaryRoot: '',
        locale: '',
        locales: [],
        updateInfo: null,
        readyToUpdate: 'none',
        allowPrerelease: false,
        autoInstallOnAppQuit: false,
        downloadingUpdate: false,
        checkingUpdate: false,
        autoDownload: false,
        useBmclAPI: true,
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
        },
        settings(state, settings) {
            // Object.assign(state.settings, settings);
        },
        useBmclApi(state, use) { state.useBmclAPI = use; },
    },
};

export default mod;

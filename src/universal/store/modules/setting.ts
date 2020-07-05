import { UpdateInfo as _UpdateInfo } from 'electron-updater';
import { ModuleOption } from '../root';
import { SettingSchema } from './setting.schema';

export interface UpdateInfo extends _UpdateInfo {
    incremental: boolean;
}

interface State extends SettingSchema {
    /**
     * All supported languages of the launcher
     */
    locales: string[];
    updateInfo: UpdateInfo | null;
    updateStatus: 'ready' | 'none' | 'pending';
    version: string;
    build: number;
}

interface Mutations {
    config: SettingSchema & { locales: string[] };
    locale: string;
    allowPrerelease: boolean;
    autoInstallOnAppQuit: boolean;
    updateStatus: 'ready' | 'none' | 'pending';
    autoDownload: boolean;
    updateInfo: UpdateInfo;
    settings: { [key: string]: number | string | boolean | object };
    useBmclApi: boolean;

    version: [string, number];
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
        updateStatus: 'none',
        allowPrerelease: false,
        autoInstallOnAppQuit: false,
        autoDownload: false,
        useBmclAPI: true,
        version: '',
        build: 0,
    },
    mutations: {
        updateInfo(state, updateInfo) {
            if (typeof updateInfo === 'object') state.updateInfo = updateInfo;
        },
        updateStatus(state, updateStatus) { state.updateStatus = updateStatus; },
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
        version(state, [version, build]) { state.version = version; state.build = build ?? 0; },
    },
};

export default mod;

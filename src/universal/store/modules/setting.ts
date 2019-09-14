import { Module, Context } from "../store";
import { UpdateInfo } from "electron-updater";
import { SettingConfig } from "./setting.config";

export declare namespace SettingModule {
    interface State extends SettingConfig {
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
        config(state: State, payload: SettingConfig & { locales: string[] }): void;
        locale(state: State, locale: string): void;
        allowPrerelease(state: State, allow: boolean): void;
        autoInstallOnAppQuit(state: State, autoInstallOnAppQuit: boolean): void;
        readyToUpdate(state: State, readyToUpdate: boolean): void;
        autoDownload(state: State, autoDownload: boolean): void;
        updateInfo(state: State, updateInfo: UpdateInfo): void;
        downloadingUpdate(state: State, prog: boolean): void;
        checkingUpdate(state: State, prog: boolean): void;
        settings(state: State, settings: { [key: string]: number | string | boolean | object }): void;
        defaultBackgroundImage(state: State, img: string | null): void;
        defaultBlur(state: State, blur: number): void;
        useBmclApi(state: State, use: boolean): void;
    }
    type C = Context<State, {}, Mutations, Actions>;
    interface Actions {
        downloadUpdate(context: C): Promise<string>;
        quitAndInstall(context: C): Promise<void>;
        checkUpdate(context: C): Promise<string>;
    }
}
export interface SettingModule extends Module<"setting", SettingModule.State, {}, SettingModule.Mutations, SettingModule.Actions> { }

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
        defaultBackgroundImage(state, img) {
            if (typeof img === 'string') state.defaultBackgroundImage = img;
        },
        defaultBlur(state, blur) {
            if (typeof blur === 'number') state.defaultBlur = blur;
        },
        useBmclApi(state, use) {
            state.useBmclAPI = use;
        },
    },
};

export default mod;

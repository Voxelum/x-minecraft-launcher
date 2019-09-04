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

declare const mod: SettingModule;

export default mod;

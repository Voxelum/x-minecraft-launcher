import { ipcMain as i } from 'electron';

import { Event, BrowserWindow } from "electron";
import { RootState } from "universal/store";
import { Store } from "vuex";

declare module "electron" {
    interface IpcMain extends EventEmitter {
        on(channel: 'vuex-dispatch', listener: (event: Event, payload: { action: string; payload: any; option: any; id: number }) => void): this;
        on(channel: 'vuex-sync', listener: (event: Event, eventId: number) => void): this;

        on(channel: 'browser-window-setup', listener: (window: BrowserWindow, name: string) => void): this;
        on(channel: 'exit', listener: () => void): this;
        on(channel: 'locale-changed', listener: () => void): this;

        on(channel: 'store-ready', listener: (store: Store<RootState>) => void): this;

        on(channel: 'minecraft-window-ready', listener: () => void): this;
        on(channel: 'minecraft-start', listener: () => void): this;
        on(channel: 'minecraft-exit', listener: (exitStatus?: { code?: string, signal?: string, crashReport?: string, crashReportLocation?: string }) => void): this;
        on(channel: 'minecraft-stdout', listener: (out: string) => void): this;
        on(channel: 'minecraft-stderr', listener: (err: string) => void): this;
        on(channel: 'minecraft-crash-report', listener: (report: { crashReport: string, crashReportLocation: string }) => void): this;

        on(channel: 'store-ready', listener: (store: Store<any>) => void): this;
        on(channel: 'reload', listener: () => void): this;

        on(channel: 'window-open', listener: (event: Event, windowId: string) => void): this;
        on(channel: 'window-hide', listener: (event: Event, windowId: number) => void): this;
        on(channel: 'window-close', listener: (event: Event) => void): this;

        on(channel: 'task-successed', listener: (id: string) => void): this;
        on(channel: 'task-failed', listener: (id: string, error: any) => void): this;

        on(channle: 'renderer-setup', listener: (event: Event, id: string) => void): this;
        on(channle: 'renderer-log', listener: (event: Event, text: string, ...args: string[]) => void): this;
        on(channle: 'renderer-warn', listener: (event: Event, text: string, ...args: string[]) => void): this;
        on(channle: 'renderer-error', listener: (event: Event, text: string, ...args: string[]) => void): this;
    }
}

export const ipcMain = i;
export default ipcMain;

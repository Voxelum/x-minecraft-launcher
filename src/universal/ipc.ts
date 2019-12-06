import { MutationPayload } from 'vuex';

declare module 'electron' {
    interface IpcMain extends NodeJS.EventEmitter {
        on(channel: 'dispatch', listener: (event: Electron.IpcMainEvent, payload: { action: string; payload: any; option: any; id: number }) => void): this;
        on(channel: 'sync', listener: (event: Electron.IpcMainEvent, eventId: number) => void): this;

        on(channel: 'window-open', listener: (event: Electron.IpcMainEvent, windowId: string) => void): this;
        on(channel: 'window-hide', listener: (event: Electron.IpcMainEvent, windowId: number) => void): this;
        on(channel: 'window-close', listener: (event: Electron.IpcMainEvent) => void): this;

        on(channle: 'renderer-setup', listener: (event: Electron.IpcMainEvent, id: string) => void): this;
        on(channle: 'renderer-log', listener: (event: Electron.IpcMainEvent, text: string, ...args: string[]) => void): this;
        on(channle: 'renderer-warn', listener: (event: Electron.IpcMainEvent, text: string, ...args: string[]) => void): this;
        on(channle: 'renderer-error', listener: (event: Electron.IpcMainEvent, text: string, ...args: string[]) => void): this;
    }
    interface IpcRenderer extends NodeJS.EventEmitter {
        /**
         * Call a service method. 
         * @param service The service name
         * @param key The service method name
         * @param payload The method payload
         * @returns The session id of this specific service call
         */
        invoke(channel: 'service-call', service: string, key: string, payload: any): Promise<string>;
        /**
         * Wait the session of service call end.
         * @param sessionId The session id which is given by `service-call`'s return
         * @returns The result of that service call
         */
        invoke(channel: 'session', sessionId: string): Promise<any>;
        /**
         * Require main process to sync
         * @param id The current mutation id
         */
        invoke(channel: 'sync', id: number): Promise<{ mutations: MutationPayload[]; length: number }>;
        invoke(channel: 'commit', type: string, payload: any): Promise<void>;

        /**
         * Notify renderer that the store is synced
         */
        emit(channel: 'synced'): this;
        on(channel: 'synced', listener: () => void): this;

        /**
         * Recieve a new commit from main process
         */
        on(channel: 'commit', listener: (event: Electron.IpcRendererEvent, mutation: MutationPayload, id: number) => void): this;

        on(channel: 'minecraft-exit', listener: (event: Electron.IpcRendererEvent, status: any) => void): this;
    }
}

import { MutationPayload } from 'vuex';
import { TaskState } from './task';
import { Exception } from './util/exception';

declare module 'electron' {
    interface App extends NodeJS.EventEmitter {
        on(channel: 'browser-window-setup', listener: (window: BrowserWindow, name: string) => void): this;
        on(channel: 'locale-changed', listener: () => void): this;

        on(channel: 'minecraft-window-ready', listener: () => void): this;
        on(channel: 'minecraft-start', listener: () => void): this;
        on(channel: 'minecraft-exit', listener: (exitStatus?: { code?: string; signal?: string; crashReport?: string; crashReportLocation?: string }) => void): this;
        on(channel: 'minecraft-stdout', listener: (out: string) => void): this;
        on(channel: 'minecraft-stderr', listener: (err: string) => void): this;

        on(channel: 'reload', listener: () => void): this;

        on(channel: 'task-successed', listener: (id: string) => void): this;
        on(channel: 'task-failed', listener: (id: string, error: any) => void): this;
    }

    interface IpcMain extends NodeJS.EventEmitter {
        on(channel: 'dispatch', listener: (event: Electron.IpcMainEvent, payload: { action: string; payload: any; option: any; id: number }) => void): this;
        on(channel: 'tasks', listener: (event: Electron.IpcMainEvent) => void): this;
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
        invoke(channel: 'sync', id: number): Promise<{ state: any; length: number }>;
        /**
         * Commit a change to remote
         */
        invoke(channel: 'commit', type: string, payload: any): Promise<void>;
        /**
         * Request for current task states
         */
        invoke(channel: 'task-state'): Promise<TaskState[]>;
        /**
         * Request an operation to a task.
         * You can cancel, pause, or resmue a task here.
         * @param option 
         */
        invoke(channel: 'task-request', option: { type: 'pause' | 'resume' | 'cancel'; id: string }): Promise<void>;

        /**
         * Notify renderer that the store is synced
         */
        emit(channel: 'synced'): this;
        on(channel: 'synced', listener: () => void): this;

        /**
         * Recieve a new commit from main process
         */
        on(channel: 'commit', listener: (event: Electron.IpcRendererEvent, mutation: MutationPayload, id: number) => void): this;

        on(channel: 'minecraft-window-ready', listener: (event: Electron.IpcRendererEvent) => void): this;
        on(channel: 'minecraft-start', listener: (event: Electron.IpcRendererEvent) => void): this;
        on(channel: 'minecraft-exit', listener: (event: Electron.IpcRendererEvent, exitStatus: { code?: number; signal?: string; crashReport?: string; crashReportLocation?: string }) => void): this;
        on(channel: 'minecraft-stdout', listener: (event: Electron.IpcRendererEvent, out: string) => void): this;
        on(channel: 'minecraft-stderr', listener: (event: Electron.IpcRendererEvent, err: string) => void): this;

        on(channel: 'exception', listener: (event: Electron.IpcRendererEvent, exception: Exception) => void): this;

        on(channel: 'task-update', listener: (event: Electron.IpcRendererEvent, update: {
            adds: { id: string; node: TaskState }[];
            childs: { id: string; node: TaskState }[];
            updates: { [id: string]: { progress?: number; total?: number; message?: string; time?: string } };
            statuses: { id: string; status: string }[];
        }) => void): this;

        on(channel: 'aquire', listener: (event: Electron.IpcRendererEvent, semphores: string[] | string) => void): this;
        on(channel: 'release', listener: (event: Electron.IpcRendererEvent, semphores: string[] | string) => void): this;
    }
}

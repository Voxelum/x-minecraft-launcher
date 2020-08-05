import { MutationPayload } from 'vuex';
import { TaskState } from './task';
import { BuiltinNotification } from './util/notification';

declare module 'electron' {

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
         * Request for current task states. It will require the main process keep sending the 'task-update' event to the renderer.
         */
        invoke(channel: 'task-subscribe', push?: boolean): Promise<TaskState[]>;

        invoke(channel: 'task-unsubscribe'): Promise<TaskState[]>;
        /**
         * Request an operation to a task.
         * You can cancel, pause, or resmue a task here.
         */
        invoke(channel: 'task-operation', option: { type: 'pause' | 'resume' | 'cancel'; id: string }): Promise<void>;

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
        on(channel: 'minecraft-exit', listener: (event: Electron.IpcRendererEvent, exitStatus: { code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }) => void): this;
        on(channel: 'minecraft-stdout', listener: (event: Electron.IpcRendererEvent, out: string) => void): this;
        on(channel: 'minecraft-stderr', listener: (event: Electron.IpcRendererEvent, err: string) => void): this;

        on(channel: 'notification', listener: (event: Electron.IpcRendererEvent, notification: BuiltinNotification) => void): this;

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

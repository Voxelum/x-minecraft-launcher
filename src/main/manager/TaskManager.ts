import { Task, TaskHandle, TaskRuntime } from '@xmcl/task';
import { ipcMain, WebContents } from 'electron';
import { TaskState, TaskStatus } from '@universal/task';
import { Manager } from '.';

import uuid = require('uuid');

export interface TaskProgress { progress?: number; total?: number; message?: string; time?: string }

export default class TaskManager extends Manager {
    private heartbeat: NodeJS.Timeout | undefined;

    private adds: { id: string; node: TaskState }[] = [];

    private childs: { id: string; node: TaskState }[] = [];

    private updates: { [id: string]: TaskProgress } = {};

    private statuses: { id: string; status: string }[] = [];

    private deferred: Function[] = [];

    private factory: Task.StateFactory<TaskState> = n => ({
        ...n,
        id: Reflect.has(n, '__uuid__') ? Reflect.get(n, '__uuid__') : uuid.v4(),
        children: [],
        time: new Date().toString(),
        progress: 0,
        total: -1,
        message: '',
    });

    private handles: { [id: string]: TaskHandle<any, any> } = {};

    private listeners: WebContents[] = [];

    readonly runtime: TaskRuntime<TaskState> = Task.createRuntime(this.factory) as any;

    constructor(private taskThreshold: number = 30) {
        super();

        ipcMain.handle('task-state', (event) => {
            this.listeners.push(event.sender);
            return Object.values(this.handles).map(h => h.root);
        });
        ipcMain.handle('task-unlisten', (event) => {
            this.listeners.splice(this.listeners.indexOf(event.sender), 1);
        });

        this.runtime.on('update', (progress, node) => {
            this.update(node.id, progress);
            node.progress = progress.progress || node.progress;
            node.total = progress.total || node.total;
            node.message = progress.message || node.message;
        });
        this.runtime.on('execute', (node, parent) => {
            if (parent) {
                if ('node' in parent) {
                    parent = (parent as any).node;
                    this.child(parent!, node);
                    parent!.children = parent!.children || [];
                    this.deferred.push(() => parent!.children.push(node));
                } else {
                    this.child(parent, node);
                    parent.children = parent.children || [];
                    this.deferred.push(() => parent!.children.push(node));
                }
            } else {
                this.add(node.id, node);
            }
            this.status(node.id, 'running');
            node.status = 'running';
        });
        this.runtime.on('finish', (_, node) => {
            this.status(node.id, 'successed');
            node.status = 'successed';
        });
        this.runtime.on('fail', (error, node) => {
            this.log(`Error task ${node.path}(${node.id})`);
            this.log(error);
            this.status(node.id, 'failed');
            node.status = 'failed';
            let errorMessage;
            if (error instanceof Error) {
                errorMessage = error.toString();
            } else {
                errorMessage = JSON.stringify(error, null, 4);
            }
            this.update(node.id, { message: errorMessage });
        });
    }

    /**
     * Submit a task to run
     */
    submit<T>(task: Task<T>, background = false): TaskHandle<T, TaskState> {
        const handle = this.runtime.submit(task);
        const id = uuid.v4();
        Object.defineProperty(task, '__uuid__', { value: id, writable: false, configurable: false, enumerable: false });
        handle.wait().finally(() => {
            delete this.handles[id];
        }).catch((e) => {
            this.error(`Task Failed ${task.name}`);
            this.error(e);
        });
        this.handles[id] = handle;
        Object.defineProperty(handle, '__handle__', { value: id, writable: false, configurable: false });
        return handle;
    }

    getHandleId(taskHandle: TaskHandle<any, any>): string | undefined {
        return Reflect.get(taskHandle, '__handle__');
    }

    getHandle(id: string): TaskHandle<any, TaskState> {
        return this.handles[id];
    }

    add(id: string, node: TaskState) {
        this.adds.push({ id, node });
        this.checkBatchSize();
    }

    update(uuid: string, update: TaskProgress) {
        const last = this.updates[uuid];
        if (last) {
            this.updates[uuid] = {
                progress: last.progress || update.progress,
                total: last.total || update.total,
                message: last.message || update.message,
            };
        } else {
            this.updates[uuid] = update;
        }
        this.checkBatchSize();
    }

    child(parent: TaskState, node: TaskState) {
        this.childs.push({
            id: parent.id,
            node,
        });
        this.checkBatchSize();
    }

    status(uuid: string, status: TaskStatus) {
        this.statuses.push({ id: uuid, status });
        this.checkBatchSize();
    }

    flush() {
        if (this.adds.length !== 0 || this.childs.length !== 0 || Object.keys(this.updates).length !== 0 || this.statuses.length !== 0) {
            this.listeners.forEach((listener) => {
                listener.send('task-update', {
                    adds: this.adds,
                    childs: this.childs,
                    updates: this.updates,
                    statuses: this.statuses,
                });
            });

            while (this.deferred.length) {
                this.deferred.pop()!();
            }

            this.adds = [];
            this.childs = [];
            this.updates = {};
            this.statuses = [];
        }
    }

    checkBatchSize() {
        if (this.adds.length + this.statuses.length + this.childs.length + Object.keys(this.updates).length > this.taskThreshold) {
            this.flush();
        }
    }

    storeReady() {
        this.heartbeat = setInterval(this.flush.bind(this), 500);
        // this.submit(Task.create('test', (c) => {
        //     c.execute(Task.create('a', (ctx) => {
        //         let progress = 0;
        //         setInterval(() => {
        //             ctx.update(progress, 100, progress.toString());
        //             progress += 10;
        //             progress = progress > 100 ? 0 : progress;
        //         }, 2000);
        //         return new Promise(() => { });
        //     }));
        //     c.execute(Task.create('b', (ctx) => {
        //         let progress = 0;
        //         setInterval(() => {
        //             ctx.update(progress, 100, progress.toString());
        //             progress += 10;
        //             progress = progress > 100 ? 0 : progress;
        //         }, 1000);
        //         return new Promise(() => { });
        //     }));
        //     return new Promise(() => { });
        // }));
    }
}

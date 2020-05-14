import { createTaskPusher } from '@main/util/task';
import { TaskState } from '@universal/task';
import { Task, TaskHandle, TaskRuntime } from '@xmcl/task';
import { ipcMain, WebContents } from 'electron';
import { Manager } from '.';

export default class TaskManager extends Manager {
    private order = 0;

    private factory: Task.StateFactory<TaskState> = (n) => ({
        ...n,
        id: `${n.path}-${this.order++}`,
        children: [],
        time: new Date().toString(),
        progress: 0,
        total: -1,
        message: '',
    });

    private idToHandleRecord: Record<string, TaskHandle<any, any>> = {};

    private idToChildsRecord: Record<string, string[]> = {};

    private handles: TaskHandle<any, any>[] = [];

    private active: TaskHandle<any, any> | undefined;

    readonly runtime: TaskRuntime<TaskState> = Task.createRuntime(this.factory);

    private pushers: Map<WebContents, () => void> = new Map();

    constructor() {
        super();

        this.runtime.on('update', (progress, node) => {
            node.progress = progress.progress || node.progress;
            node.total = progress.total || node.total;
            node.message = progress.message || node.message;
        });
        this.runtime.on('execute', (node, parent) => {
            if (parent) {
                this.idToHandleRecord[node.id] = this.idToHandleRecord[parent.id];
                let rootId = this.idToHandleRecord[node.id].root.id;
                this.idToChildsRecord[rootId].push(node.id);
                parent.children.push(node);
            }
            node.status = 'running';
        });
        this.runtime.on('pause', (node) => {
            node.status = 'paused';
        });
        this.runtime.on('finish', (r, node) => {
            node.status = 'successed';
        });
        this.runtime.on('resume', (node) => {
            node.status = 'running';
        });
        this.runtime.on('finish', (_, node) => {
            node.status = 'successed';
        });
        this.runtime.on('cancel', (node) => {
            node.status = 'cancelled';
        });
        this.runtime.on('fail', (error, node) => {
            this.log(`Error task ${node.path}(${node.id})`);
            this.log(error);
            node.status = 'failed';
        });
    }

    /**
     * Submit a task to run
     */
    submit<T>(task: Task<T>): TaskHandle<T, TaskState> {
        const handle = this.runtime.submit(task);
        const id = handle.root.id;
        handle.wait().finally(() => {
            delete this.idToHandleRecord[id];
            let children = this.idToChildsRecord[id];
            delete this.idToChildsRecord[id];
            for (let c of children) {
                delete this.idToChildsRecord[c];
            }

            this.handles.splice(this.handles.findIndex((t) => t.root.id === id), 1);
            if (this.active === handle) {
                this.active = this.handles[this.handles.length - 1];
            }
        }).catch((e) => {
            this.error(`Task Failed ${task.name}`);
            this.error(e);
        });
        this.idToChildsRecord[id] = [];
        this.idToHandleRecord[id] = handle;
        this.handles.push(handle);
        this.active = handle;
        return handle;
    }

    getHandleId(taskHandle: TaskHandle<any, any>): string | undefined {
        return taskHandle.root.id;
    }

    getHandle(id: string): TaskHandle<any, TaskState> {
        return this.idToHandleRecord[id];
    }

    getActiveTask() {
        return this.active;
    }

    isRootTask(id: string) {
        return !!this.idToHandleRecord[id];
    }

    // storeReady() {
    //     this.submit(Task.create('test', (c) => {
    //         c.execute(Task.create('a', (ctx) => {
    //             let progress = 0;
    //             let paused = false;
    //             ctx.pausealbe(() => {
    //                 paused = true;
    //             }, () => {
    //                 paused = false;
    //             });
    //             setInterval(() => {
    //                 if (!paused) {
    //                     ctx.update(progress, 100, progress.toString());
    //                     progress += 10;
    //                     progress = progress > 100 ? 0 : progress;
    //                 }
    //             }, 2000);
    //             return new Promise(() => { });
    //         }), 100);
    //         c.execute(Task.create('b', (ctx) => {
    //             let progress = 0;
    //             setInterval(() => {
    //                 ctx.update(progress, 100, progress.toString());
    //                 progress += 10;
    //                 progress = progress > 100 ? 0 : progress;
    //             }, 1000);
    //             return new Promise(() => { });
    //         }));
    //         return new Promise(() => { });
    //     }));
    // }

    // SETUP CODE
    setup() {
        ipcMain.handle('task-subscribe', (event) => {
            let pusher = createTaskPusher(this.runtime, 500, 30, (payload) => {
                event.sender.send('task-update', payload);
            });
            this.pushers.set(event.sender, pusher);
            return this.handles.map(h => h.root);
        });
        ipcMain.handle('task-unsubscribe', (event) => {
            let pusher = this.pushers.get(event.sender);
            if (pusher) { pusher(); }
        });
        ipcMain.handle('task-operation', (event, { type, id }) => {
            if (!this.idToHandleRecord[id]) {
                this.warn(`Cannot ${type} a unknown task id ${id}`);
                return;
            }
            switch (type) {
                case 'pause':
                    this.idToHandleRecord[id].pause();
                    break;
                case 'resume':
                    this.idToHandleRecord[id].resume();
                    break;
                case 'cancel':
                    this.idToHandleRecord[id].cancel();
                    break;
                default:
            }
        });
    }
}

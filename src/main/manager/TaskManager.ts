import LauncherApp from '@main/app/LauncherApp';
import { Client } from '@main/engineBridge';
import { createTaskPusher } from '@main/util/taskMonitor';
import { TaskState } from '@universal/task';
import { Task, TaskHandle, TaskRuntime } from '@xmcl/task';
import { v4 } from 'uuid';
import { Manager } from '.';

export default class TaskManager extends Manager {
    private order = 0;

    private factory: Task.StateFactory<TaskState> = (n) => ({
        ...n,
        id: `${n.path}-${this.order++}-${v4()}`,
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

    private pushers: Map<Client, () => void> = new Map();

    constructor(app: LauncherApp) {
        super(app);

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
            this.log(`Task node ${node.id} paused`);
            node.status = 'paused';
        });
        this.runtime.on('finish', (r, node) => {
            node.status = 'successed';
        });
        this.runtime.on('resume', (node) => {
            this.log(`Task node ${node.id} resmued`);
            node.status = 'running';
        });
        this.runtime.on('finish', (_, node) => {
            node.status = 'successed';
        });
        this.runtime.on('cancel', (node) => {
            this.log(`Task node ${node.id} cancelled`);
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
        return this.handles.some(h => h.root.id === id);
    }

    storeReady() {
        // let i = 0;
        // setInterval(() => {
        //     this.submit(Task.create(`test-${i}`, async (c) => {
        //         i++;
        //         await c.execute(Task.create('a', () => new Promise((resolve) => setTimeout(resolve, 1000))));
        //         await c.execute(Task.create('b', () => new Promise((resolve) => setTimeout(resolve, 1000))));
        //         await c.execute(Task.create('c', () => new Promise((resolve) => setTimeout(resolve, 1000))));
        //     }));
        // }, 3000);
        // this.submit(Task.create('test', (c) => {
        //     c.execute(Task.create('a', (ctx) => {
        //         let progress = 0;
        //         let paused = false;
        //         ctx.pausealbe(() => {
        //             paused = true;
        //         }, () => {
        //             paused = false;
        //         });
        //         setInterval(() => {
        //             if (!paused) {
        //                 ctx.update(progress, 100, progress.toString());
        //                 progress += 10;
        //                 progress = progress > 100 ? 0 : progress;
        //             }
        //         }, 2000);
        //         return new Promise(() => { });
        //     }), 100);
        //     c.execute(Task.create('b', (ctx) => {
        //         let progress = 0;
        //         let paused = false;
        //         ctx.pausealbe(() => {
        //             paused = true;
        //         }, () => {
        //             paused = false;
        //         });
        //         setInterval(() => {
        //             if (!paused) {
        //                 ctx.update(progress, 100, progress.toString());
        //                 progress += 10;
        //                 progress = progress > 100 ? 0 : progress;
        //             }
        //         }, 2000);
        //         return new Promise(() => { });
        //     }));
        //     return new Promise(() => { });
        // }));
    }

    // SETUP CODE
    setup() {
        this.app.handle('task-subscribe', (event) => {
            let pusher = createTaskPusher(this.runtime, 500, 30, (payload) => {
                event.sender.send('task-update', payload);
            });
            this.pushers.set(event.sender, pusher);
            return this.handles.map(h => h.root);
        });
        this.app.handle('task-unsubscribe', (event) => {
            let pusher = this.pushers.get(event.sender);
            if (pusher) { pusher(); }
        });
        this.app.handle('task-operation', (event, { type, id }) => {
            if (!this.idToHandleRecord[id]) {
                this.warn(`Cannot ${type} a unknown task id ${id}`);
                return;
            }
            switch (type) {
                case 'pause':
                    this.log(`Request ${id} to pause`);
                    this.idToHandleRecord[id].pause();
                    break;
                case 'resume':
                    this.log(`Request ${id} to resume`);
                    this.idToHandleRecord[id].resume();
                    break;
                case 'cancel':
                    this.log(`Request ${id} to cancel`);
                    this.idToHandleRecord[id].cancel();
                    break;
                default:
            }
        });
    }
}

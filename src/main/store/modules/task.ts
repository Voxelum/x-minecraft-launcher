import { v4 } from 'uuid';
import { ipcMain } from 'electron';
import { requireString } from 'main/utils';
import base, { TaskModule, TaskState } from 'universal/store/modules/task';
import { Task } from '@xmcl/minecraft-launcher-core';

const TASK_FORCE_THRESHOLD = 30;

interface Progress { progress?: number, total?: number, message?: string, time?: string }
class TaskWatcher {
    private listener: NodeJS.Timeout | undefined;
    private adds: { id: string, node: TaskState }[] = [];
    private childs: { id: string, node: TaskState }[] = [];
    private updates: { [id: string]: Progress } = {};
    private statuses: { id: string, status: string }[] = []

    private forceUpdate: () => void = () => { };

    add(id: string, node: TaskState) {
        this.adds.push({ id, node });
        this.checkBatchSize();
    }

    update(uuid: string, update: Progress) {
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

    child(id: string, node: TaskState) {
        this.childs.push({
            id,
            node,
        });
        this.checkBatchSize();
    }

    status(uuid: string, status: string) {
        this.statuses.push({ id: uuid, status });
        this.checkBatchSize();
    }

    checkBatchSize() {
        if (this.adds.length + this.statuses.length + this.childs.length + Object.keys(this.updates).length > TASK_FORCE_THRESHOLD) {
            this.forceUpdate();
        }
    }

    ensureListener(context: any) {
        if (this.listener === undefined) {
            this.forceUpdate = () => {
                if (this.adds.length !== 0 || this.childs.length !== 0 || Object.keys(this.updates).length !== 0 || this.statuses.length !== 0) {
                    context.commit('updateBatchTask', {
                        adds: this.adds,
                        childs: this.childs,
                        updates: this.updates,
                        statuses: this.statuses,
                    });

                    this.adds = [];
                    this.childs = [];
                    this.updates = {};
                    this.statuses = [];
                }
            };
            this.listener = setInterval(this.forceUpdate, 500);
        }
    }
}

interface WrappedTask<T> extends Task<T, TaskState> {
    promise: Promise<T>;
    id: string;
    background: boolean;
}

let taskWatcher = new TaskWatcher();
let nameToTask: { [name: string]: WrappedTask<any> } = {};
let idToTask: { [name: string]: WrappedTask<any> } = {};

ipcMain.on('reload', () => { // reload to discard old record to prevent memory leak
    taskWatcher = new TaskWatcher();
    nameToTask = {};
    idToTask = {};
});

const mod: TaskModule = {
    ...base,
    actions: {
        async spawnTask(context, name) {
            requireString(name);
            const id = v4();
            const node: TaskState = {
                _internalId: id,
                name,
                total: -1,
                progress: -1,
                status: 'running',
                path: name,
                children: [],
                error: null,
                message: '',
            };
            context.commit('hookTask', { task: node, id });
            return id;
        },
        async updateTask(context, payload) {
            requireString(payload.id);
            taskWatcher.update(payload.id, payload);
        },
        async finishTask(context, payload) {
            requireString(payload.id);
            taskWatcher.status(payload.id, 'successed');
        },
        async cancelTask(context, uuid) {
            const task = idToTask[uuid];
            if (task) { task.cancel(); }
        },
        async waitTask(context, uuid) {
            const task = idToTask[uuid];
            if (!task) return Promise.resolve();
            return task.promise;
        },
        async executeAction(context, { action, background, payload }) {
            const task = Task.create(action, () => context.dispatch(action as any, payload)) as WrappedTask<any>;
            task.background = background || true;
            await context.dispatch('executeTask', task);
            return task.promise;
        },
        async executeTask(context, taskIn) {
            const task: WrappedTask<any> = taskIn as WrappedTask<any>;
            const key = JSON.stringify({ name: task.root.name, arguments: task.root.arguments });

            if (nameToTask[key]) {
                return nameToTask[key].id;
            }

            console.log(`Task Execute: ${task.root.name}`);

            taskWatcher.ensureListener(context);
            const uuid = task.id || v4();
            let _internalId = 0;
            task.on('child', (parent, child) => {
                child._internalId = `${uuid}-${_internalId}`;
                _internalId += 1;

                child.time = new Date().toLocaleTimeString();
                taskWatcher.child(parent._internalId, child);
            });
            task.on('update', (update, node) => {
                taskWatcher.update(node._internalId, update);
            });
            task.on('finish', (result, node) => {
                if (task.root === node && !task.background) {
                    ipcMain.emit('task-successed', node._internalId);
                    delete nameToTask[key];
                }

                taskWatcher.status(node._internalId, 'successed');
            });
            task.on('node-error', (error, node) => {
                if (task.root === node && !task.background) {
                    ipcMain.emit('task-failed', node._internalId, error);
                    console.error(`Task [${node.name}] failed.`);
                    console.error(error);
                    delete nameToTask[key];
                }

                let errorMessage;
                if (error instanceof Error) {
                    errorMessage = error.toString();
                } else {
                    errorMessage = JSON.stringify(error, null, 4);
                }
                taskWatcher.update(node._internalId, { message: errorMessage });
                taskWatcher.status(node._internalId, 'failed');
            });
            if (task.background) {
                task.background = true;
            }
            task.root.time = new Date().toLocaleTimeString();
            task.root._internalId = uuid;
            task.id = uuid;

            context.commit('hookTask', { id: uuid, task: task.root });

            task.execute();

            nameToTask[key] = task;
            idToTask[uuid] = task;

            return uuid;
        },
    },
};

export default mod;

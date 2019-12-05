import { Task, TaskHandle, TaskRuntime } from "@xmcl/minecraft-launcher-core";
import { Store } from "vuex";
import { Manager } from ".";
import uuid = require("uuid");
import { TaskState, TaskStatus } from "universal/store/modules/task";

export interface TaskProgress { progress?: number, total?: number, message?: string, time?: string }

export default class TaskManager extends Manager {
    private listener: NodeJS.Timeout | undefined;
    private adds: { id: string, node: TaskState }[] = [];
    private childs: { id: string, node: TaskState }[] = [];
    private updates: { [id: string]: TaskProgress } = {};
    private statuses: { id: string, status: string }[] = []
    private forceUpdate: () => void = () => { };
    private factory: Task.StateFactory<TaskState> = (n) => ({
        ...n,
        id: Reflect.has(n, '__uuid__') ? Reflect.get(n, '__uuid__') : uuid.v4(),
        children: [],
        time: new Date().toString(),
    });
    private handles: { [id: string]: TaskHandle<any, any> } = {};
    readonly runtime: TaskRuntime<TaskState> = Task.createRuntime(this.factory) as any;

    constructor(private taskThreshold: number = 30) {
        super();
        this.runtime.on('update', (progress, node) => {
            this.update(node.id, progress);
        });
        this.runtime.on('execute', (node, parent) => {
            if (parent) {
                this.child(parent.id, node);
            } else {
                this.add(node.id, node);
            }
            this.status(node.id, 'running');
        });
        this.runtime.on('finish', (_, node) => {
            this.status(node.id, 'successed');
        });
        this.runtime.on('fail', (error, node) => {
            this.status(node.id, 'failed');
            let errorMessage;
            if (error instanceof Error) {
                errorMessage = error.toString();
            } else {
                errorMessage = JSON.stringify(error, null, 4);
            }
            this.update(node.id, { message: errorMessage })
        });
    }

    /**
     * Submit a task to run
     */
    submit<T>(task: Task.Function<T> | Task.Object<T>, background: boolean = false): TaskHandle<T, TaskState> {
        const handle = this.runtime.submit(task);
        const id = uuid.v4();
        Object.defineProperty(task, '__uuid__', { value: id, writable: false, configurable: false, enumerable: false });
        handle.wait().finally(() => {
            delete this.handles[id];
        });
        this.handles[id] = handle;
        Object.defineProperty(handle, '__handle__', { value: id, writable: false, configurable: false })
        return handle;
    }

    getHandleId(taskHandle: TaskHandle<any, any>): string | undefined {
        return Reflect.get(taskHandle, '__handle__');
    }

    getHandle(id: string): TaskHandle<any, TaskState> {
        return this.handles[id];
    }

    add = (id: string, node: TaskState) => { };

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

    child(id: string, node: TaskState) {
        this.childs.push({
            id,
            node,
        });
        this.checkBatchSize();
    }

    status(uuid: string, status: TaskStatus) {
        this.statuses.push({ id: uuid, status });
        this.checkBatchSize();
    }

    checkBatchSize() {
        if (this.adds.length + this.statuses.length + this.childs.length + Object.keys(this.updates).length > this.taskThreshold) {
            this.forceUpdate();
        }
    }

    storeReady(context: Store<any>) {
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
        this.add = (id, node) => {
            context.commit('hookTask', { id, task: node });
        };
        this.listener = setInterval(this.forceUpdate, 500);
    }
}

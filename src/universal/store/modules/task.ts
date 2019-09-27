import Vue from 'vue';

import { Task } from '@xmcl/minecraft-launcher-core';
import { Context, Module } from "..";

export interface WrappedTask<T> extends Task<T, TaskState> {
    id: string;
    background: boolean;
}
export interface TaskState extends Task.State {
    _internalId: string;
    children: TaskState[];
    time?: string;
}
export declare namespace TaskModule {

    interface State {
        tree: { [uuid: string]: TaskState },
        tasks: TaskState[],
        maxLog: number,
    }
    interface Mutations {
        createTask(state: State, option: { id: string, name: string }): void;
        pruneTasks(state: State): void;
        hookTask(state: State, option: { id: string, task: TaskState }): void;
        updateBatchTask(state: State, option: {
            adds: { id: string, node: TaskState }[],
            childs: { id: string, node: TaskState }[],
            updates: { [id: string]: { progress?: number, total?: number, message?: string, time?: string } },
            statuses: { id: string, status: string }[],
        }): void;
    }

    type C = Context<TaskModule.State, {}>;
    interface Actions {
        executeAction<T>(context: C, payload: { action: string, payload?: any, background?: boolean }): Promise<any>;

        executeTask(context: C, task: Task<any>): Promise<TaskHandle>;
        spawnTask(context: C, name: string): Promise<TaskHandle>;
        updateTask(context: C, data: { id: TaskHandle, progress: number, total?: number, message?: string }): Promise<void>;
        waitTask(context: C, uuid: TaskHandle): Promise<any>;
        finishTask(context: C, payload: { id: TaskHandle }): Promise<void>;
        cancelTask(context: C, uuid: TaskHandle): Promise<void>;
    }

}

export type TaskModule = Module<"task", TaskModule.State, {}, TaskModule.Mutations, TaskModule.Actions>;

const mod: TaskModule = {
    state: {
        tree: {},
        tasks: [],

        maxLog: 20,
    },
    mutations: {
        createTask(state, { id, name }) {
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
            state.tree[id] = node;
            state.tasks.push(state.tree[id]);
        },
        pruneTasks(state) {
            function remove(task: TaskState) {
                if (task.children && task.children.length !== 0) {
                    task.children.forEach(remove);
                }
                Vue.delete(state.tree, task._internalId);
            }
            if (state.tasks.length > state.maxLog) {
                for (const task of state.tasks.slice(state.maxLog, state.tasks.length - state.maxLog)) {
                    remove(task);
                }

                state.tasks = [...state.tasks.slice(0, state.maxLog)];
            }
        },
        hookTask(state, { id, task }) {
            const idToNode = state.tree;
            const local = { ...task, tasks: [], errors: [] };
            state.tasks.unshift(local);
            idToNode[id] = local;
        },
        updateBatchTask(state, {
            adds, childs, updates, statuses,
        }) {
            const idToNode = state.tree;
            for (const add of adds) {
                const { id, node } = add;
                const local = { ...node, tasks: [], errors: [] };
                state.tasks.unshift(local);
                idToNode[id] = local;
            }
            for (const child of childs) {
                const { id, node } = child;
                const local = { ...node, tasks: [], errors: [] };
                if (!idToNode[id]) {
                    console.log(`Cannot add child ${node._internalId} for parent ${id}.`);
                } else {
                    idToNode[id].children.push(local);
                    idToNode[node._internalId] = local;
                }
            }
            for (const update of Object.keys(updates).map(k => ({ id: k, ...updates[k] }))) {
                const { id, progress, total, message, time } = update;
                const task = idToNode[id];
                if (task) {
                    if (progress) task.progress = progress;
                    if (total) task.total = total;
                    if (message) task.message = message;
                    if (time) task.time = time || new Date().toLocaleTimeString();
                } else {
                    console.log(`Cannot apply update for task ${id}.`);
                }
            }
            for (const s of statuses) {
                if (!s) { continue; }
                const { id, status } = s;
                const task = idToNode[id];
                if (task) {
                    task.status = status as any;
                } else {
                    console.log(`Cannot update status for task ${id}.`);
                }
            }
        },
    },
};

export default mod;

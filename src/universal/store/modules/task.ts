import { TaskNode } from '@xmcl/minecraft-launcher-core';
import Vue from 'vue';
import { ModuleOption } from '../root';

export type TaskStatus = 'successed' | 'failed' | 'ready' | 'running';

export interface TaskState extends TaskNode {
    id: string;
    children: TaskState[];
    time?: string;
    background?: boolean;
    progress?: number;
    total?: number;
    message?: string;
    status?: TaskStatus;
}

interface State {
    tree: { [uuid: string]: TaskState };
    tasks: TaskState[];
    maxLog: number;
}
interface Mutations {
    pruneTasks: (state: State) => void;
    hookTask: { id: string; task: TaskState };
    updateBatchTask: {
        adds: { id: string; node: TaskState }[];
        childs: { id: string; node: TaskState }[];
        updates: { [id: string]: { progress?: number; total?: number; message?: string; time?: string } };
        statuses: { id: string; status: string }[];
    };
}

export type TaskModule = ModuleOption<State, {}, Mutations, {}>;

const mod: TaskModule = {
    state: {
        tree: {},
        tasks: [],
        maxLog: 20,
    },
    mutations: {
        pruneTasks(state) {
            function remove(task: TaskState) {
                if (task.children && task.children.length !== 0) {
                    task.children.forEach(remove);
                }
                Vue.delete(state.tree, task.id);
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
                    console.log(`Cannot add child ${node.id} for parent ${id}.`);
                } else {
                    idToNode[id].children.push(local);
                    idToNode[node.id] = local;
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

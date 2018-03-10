import { ipcRenderer } from 'electron'
import { Task } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import Vue from 'vue'
import { v4 } from 'uuid'
import { EventEmitter } from 'events'

class TaskProxy extends EventEmitter {
    constructor(uuid, id, timeout = 100000) {
        super()
        this.id = id;

        const handler = (event, type, childPaths, args) => {
            switch (type) {
                case 'error':
                case 'finish':
                    if (childPaths.length === 0) {
                        ipcRenderer.removeListener(uuid, handler);
                        clearTimeout(this.timeout);
                    }
                    break;
                default:
                case 'update':
                case 'child':
                    break;
            }
            this.emit(type, childPaths, args);
        };
        this.timeout = setTimeout(() => {
            ipcRenderer.removeListener(uuid, handler);
            this.emit('error', [], new Error(`Timeout ${timeout} millisecond`));
        }, timeout)

        ipcRenderer.on(uuid, handler)
    }
}

export default {
    state: {
        tasks: {},
        failed: [],
        finished: [],
    },
    getters: {
        runningTasks: state => state.tasks,
        finishedTasks: state => state.finished,
        errorTasks: state => state.failed,
        tasksCount: (states, getters) => Object.keys(getters.runningTasks).length,
    },
    mutations: {
        updateTask(state, { uuid, paths, progress, total, status }) {
            let task = state.tasks[uuid];
            if (paths) for (const p of paths) task = task.children[p];
            task.progress = progress;
            if (total) task.total = total;
            if (status) task.status = status;
        },
        addTask(state, { uuid, id }) {
            Vue.set(state.tasks, uuid, {
                id,
                total: -1,
                children: {},
                progress: -1,
                error: '',
                status: 'running',
            });
        },
        errorTask(state, { uuid, paths, error }) {
            let task = state.tasks[uuid];
            if (paths.length === 0) {
                task.error = error;
                task.status = 'error'
                state.failed.push(task)
                Vue.delete(state.tasks, uuid)
            } else {
                for (const p of paths) task = task.children[p]
                task.error = error;
                task.status = 'error'
            }
        },
        finishTask(state, { uuid, paths }) {
            let task = state.tasks[uuid];
            if (paths.length === 0) {
                Vue.delete(state.tasks, uuid);
                task.status = 'finish';
                state.finished.push(task);
            } else {
                for (const p of paths) task = task.children[p]
                task.status = 'finish'
            }
        },
        addChildTask(state, { uuid, paths, id }) {
            let task = state.tasks[uuid];
            for (const p of paths) {
                task = task.children[p]
            }
            task.children[id] = {
                id,
                total: -1,
                children: {},
                progress: -1,
                error: '',
                status: 'running',
            }
        },
    },
    actions: {
        /**
         * 
         * @param {ActionContext} context 
         * @param {{service:string, action:string, timeout:number, payload:any}} $payload  
         */
        query(context, $payload) {
            const { service, action, payload, timeout } = $payload;
            return new Promise((resolve, reject) => {
                const id = v4();
                const task = new TaskProxy(id, `${service}.${action}`, timeout)
                context.dispatch('listenTask', { uuid: id, task })
                task.on('finish', (paths, result) => { if (paths.length === 0) resolve(result) })
                task.on('error', (paths, error) => { if (paths.length === 0) reject(error) })
                ipcRenderer.send('query', {
                    id,
                    service,
                    action,
                    payload,
                })
            });
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{uuid:string, task:Task}} payload 
         */
        listenTask(context, payload) {
            const { uuid, task } = payload;
            task.on('update', (paths, { progress, total, status }) => {
                context.commit('updateTask', { uuid, paths, progress, total, status });
            })
            task.on('finish', (paths, result) => {
                context.commit('finishTask', { uuid, paths });
            })
            task.on('error', (paths, error) => {
                context.commit('errorTask', { uuid, paths, error })
            })
            task.on('child', (paths, childId) => {
                context.commit('addChildTask', { uuid, paths, id: childId });
            })
            context.commit('addTask', { uuid, id: task.id });
        },
    },
}

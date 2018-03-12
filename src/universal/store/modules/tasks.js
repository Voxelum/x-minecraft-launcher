import { Task } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import Vue from 'vue'
import { v4 } from 'uuid'

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
         * @param {vuex.ActionContext} context 
         * @param {{id:string}} payload 
         */
        create(context, payload) {
            
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

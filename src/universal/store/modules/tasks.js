import { Task } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import Vue from 'vue'
import { v4 } from 'uuid'

export default {
    namespaced: true,
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
        update(state, { path, progress, total, status }) {
            if (!path || path.length === 0) throw new Error();
            let root = state;
            for (const p of path) root = root.tasks[p];
            if (progress) root.progress = progress;
            if (total) root.total = total;
            if (status) root.status = status;
        },
        create(state, { id, path }) {
            const ps = path || []
            const uuid = v4();
            let root = state;
            for (const p of ps) root = root.tasks[p];
            Vue.set(root.tasks, uuid, {
                id,
                total: -1,
                progress: -1,
                tasks: {},
                error: '',
                status: 'running',
            });
        },
        // error(state, { uuid, path, error }) {
        //     let task = state.tasks[uuid];
        //     if (path.length === 0) {
        //         task.error = error;
        //         task.status = 'error'
        //         state.failed.push(task)
        //         Vue.delete(state.tasks, uuid)
        //     } else {
        //         for (const p of path) task = task.children[p]
        //         task.error = error;
        //         task.status = 'error'
        //     }
        // },
        finish(state, { path }) {
            if (!path || path.length === 0) throw new Error();
            let root = state;
            let uuid;
            let parent;
            for (const p of path) {
                parent = root;
                root = root.tasks[p];
                uuid = p;
            }
            root.status = 'finish';
            Vue.delete(parent.tasks, uuid);
            if (parent === state) {
                state.finished.push(root);
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

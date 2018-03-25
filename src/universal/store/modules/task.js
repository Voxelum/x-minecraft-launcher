import { Task } from 'treelike-task'
import { ActionContext } from 'vuex'
import Vue from 'vue'
import { v4 } from 'uuid'

class TaskProxy {
    constructor(context, path) {
        this.context = context;
        this.path = path;
    }
    create(id) {
        return this.context.dispatch('create', { id, path: this.path });
    }
    update(progress, total, description) {
        this.context.commit('update', { path: this.path, progress, total, description });
    }
    finish(error) {
        this.context.commit('finish', { path: this.path, error });
    }
}

export default {
    namespaced: true,
    state: {
        tasks: {},
        finished: [],
    },
    getters: {
        runnings: state => state.tasks,
        finished: state => state.finished,
        count: (states, getters) => Object.keys(getters.runnings).length,
    },
    mutations: {
        update(state, { path, progress, total, description }) {
            if (!path || path.length === 0) throw new Error();
            let root = state;
            for (const p of path) root = root.tasks[p];
            if (progress) root.progress = progress;
            if (total) root.total = total;
            if (description) root.description = description;
        },
        create(state, { id, uuid, path }) {
            const ps = path || []
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
        finish(state, { path, result, error }) {
            if (!path || path.length === 0) throw new Error();
            let root = state;
            let uuid;
            let parent;
            for (const p of path) {
                parent = root;
                root = root.tasks[p];
                uuid = p;
            }
            root.status = error ? 'error' : 'finish';
            root.result = error || result;

            if (parent === state) {
                state.finished.push(root);
                Vue.delete(parent.tasks, uuid);
            }
        },
    },
    actions: {
        /**
         * 
         * @param {vuex.ActionContext} context 
         * @param {{id:string, path: string[]}} payload 
         */
        create(context, payload) {
            const uuid = v4();
            context.commit('create', { ...payload, uuid });
            const proxy = new TaskProxy(context, [...(payload.path || []), uuid]);
            return proxy;
        },
        /**
         * 
         * @param {vuex.ActionContext} context 
         * @param {Task} task 
         */
        async listen(context, task) {
            await context.dispatch('create', { id: task.id })
            task.onChild((path, child) => {
                console.log(`child create ${path}:${child}`);
                context.dispatch('create', { path, id: child });
            });
            task.onFinish((path, result) => {
                context.commit('finish')
            });
            task.onError((path, result) => {
                context.commit('finish', result);
            });
            task.onUpdate((path, progress, total, status) => {
                context.commit('update', { path, progress, total, status })
            })
        },
    },
}

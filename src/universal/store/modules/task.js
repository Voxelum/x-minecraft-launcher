import { Task } from 'treelike-task'
import { ActionContext } from 'vuex'
import Vue from 'vue'
import { v4 } from 'uuid'

class TaskProxy {
    constructor(context, path) {
        this.context = context;
        this.path = path;
    }
    create(name) {
        return this.context.dispatch('create', { name, path: this.path });
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
        tasks: {
        },
        running: [],
        all: [],
    },
    getters: {
        running: state => state.running,
        all: state => state.all,
        get: state => id => state.tasks[id],
    },
    mutations: {
        $finish(state, node) {
            Vue.delete(state.running, state.running.indexOf(node.id));

            Vue.delete(state.all, state.all.indexOf(node.id))
            state.all.push(node.id);

            state.tasks[node.id] = Object.freeze(Object.assign({}, node));
        },
        $create(state, node) {
            state.running.push(node.id);
            state.all.push(node.id);

            state.tasks[node.id] = Object.freeze(Object.assign({}, node));
        },
        $update(state, node) {
            Vue.delete(state.tasks, node.id);
            Vue.delete(state.running, state.running.indexOf(node.id));
            Vue.delete(state.all, state.all.indexOf(node.id))
            state.tasks[node.id] = Object.freeze(Object.assign({}, node));
            state.running.push(node.id);
            state.all.push(node.id);
        },
        $remove(state, node) {
            Vue.delete(state.all, state.all.indexOf(node.id));
            Vue.delete(state.tasks, node.id);
        },
    },
    actions: {
        /**
         * 
         * @param {vuex.ActionContext} context 
         * @param {{name:string, path: string[], id?:string}} payload 
         */
        create(context, payload) {
            const id = payload.id || v4();
            context.commit('create', { ...payload, id });
            const proxy = new TaskProxy(context, [...(payload.path || []), id]);
            return proxy;
        },
        remove(context, task) {
            context.commit('$remove', task);
        },
        /**
         * 
         * @param {vuex.ActionContext} context 
         * @param {Task} task 
         */
        async listen(context, task) {
            const root = task.root;
            root.tasks = {};
            context.commit('$create', root);
            const timer = setInterval(() => {
                if (root.status === 'finish') clearInterval(timer)
                context.commit('$update', root);
            }, 500);
            task.onChild((path, parent, child) => {
                child.tasks = {};
                parent.tasks[child.id] = child;
            });
            task.onFinish((path, result, node) => {
                node.status = 'finish';
                if (context.state.tasks[node.id]) {
                    context.commit('$finish', root);
                    clearInterval(timer);
                    const fs = require('fs-extra');
                    fs.writeFile('C:\\Users\\cijhn\\Desktop\\OUT.json', JSON.stringify(root))
                }
            });
            task.onError((path, err, node) => {
                node.status = 'finish';
                if (context.state.tasks[node.id]) {
                    context.commit('$finish', root);
                    clearInterval(timer);
                }
            });
            task.onUpdate((path, update, node) => {
                node.progress = update.progress;
                node.total = update.total;
                node.status = update.status;
            })
        },
    },
}

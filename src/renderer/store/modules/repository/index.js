import * as fs from 'fs-extra'
import * as path from 'path'
import crypto from 'crypto'
import Vue from 'vue'
import { ActionContext } from 'vuex'

export default {
    state() {
        return {
            root: '',
            metaType: '',
            resources: {},
        }
    },
    getters: {
        allKeys: state => Object.keys(state.resources),
        values: (state, gets) => gets.allKeys.map(key => state.resources[key]),
        get: state => key => state.resources[key],
    },
    mutations: {
        rename(context, { resource, name }) {
            resource.name = name;
        },
        /**
         * @param {Resource[]} payload 
         */
        resources: (state, payload) => {
            payload.forEach((res) => { Vue.set(state.resources, res.hash, res) })
        },
        delete(state, payload) {
            Vue.delete(state.resources, payload);
        },
    },
    actions: {
        load: context => context.dispatch('readFolder', { path: context.state.root }, { root: true })
            .then(files => Promise.all(
                files.filter(file => file.endsWith('.json'))
                    .map(file => context.dispatch('read', {
                        path: `${context.state.root}/${file}`,
                        fallback: undefined,
                        encoding: 'json',
                    }, { root: true })
                        .catch(e => undefined)),
            ))
            .then((metas) => {
                context.commit('resources', metas.filter(res => res !== undefined))
            }),
        save(context, { mutation, object }) {
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string|Resource} resource 
         */
        delete(context, resource) {
            if (typeof resource === 'string') {
                resource = context.state.resources[resource];
            }
            context.commit('delete', resource.hash)
            return context.dispatch('delete', { path: `resourcepacks/${resource.hash}.json` }, { root: true })
                .then(() => context.dispatch('delete', { path: `resourcepacks/${resource.hash}${resource.type}` }, { root: true }))
        },
        rename(context, { resource, name }) { },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string[]|string} files 
         */
        import(context, files) {
            /**
             * @type {string}
             */
            let arr
            if (typeof payload === 'string') arr = [files]
            else if (files instanceof Array) arr = files
            else return Promise.reject('Illegal Type')
            return context.dispatch('query', { service: 'repository', action: 'import', payload: { root: context.state.root, files: arr, metaType: context.state.metaType } })
                .then(
                /**
                 * @param {Resource[]} resources
                 */
                (resources) => {
                    context.commit('resources', resources)
                })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{resource:string|Resource, targetDirectory:string}} payload 
         */
        export(context, payload) {
            const { resource, targetDirectory } = payload
            return new Promise((resolve, reject) => {
                /**
                 * @type {Resource}
                 */
                let res;
                if (typeof resource === 'string') {
                    res = context.state.resources[resource]
                } else res = resource;
                return res;
            }).then((res) => { // TODO mkdir
                const option = payload.option || {}
                return context.dispatch('export', {
                    file: `${context.state.root}/${res.hash}${res.type}`,
                    toFolder: targetDirectory,
                    mode: 'link',
                    name: `${res.hash}${res.type}`,
                }).then(() => res)
            });
        },
        refresh(context, payload) {
            /* return context.dispatch('readFolder', { path: this.context.state.root }, { root: true })
                .then(files => Promise.all(
                    files.map(file => context.dispatch('read', {
                        path: `${this.context.state.root}/${file}`,
                        fallback: undefined,
                    }).then((buf) => {
                        if (!buf) return;
                        const resource = new Resource($hash(buf), file, path.extname(file))
                        context.commit('put', { key: resource.hash, value: resource })
                    })))); */
        },
    },
}

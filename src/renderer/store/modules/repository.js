import * as fs from 'fs-extra'
import * as path from 'path'
import crypto from 'crypto'
import Vue from 'vue'
import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: () => ({ resources: {} }),
    getters: {
        allKeys: state => Object.keys(state.resources),
        values: (state, gets) => gets.allKeys.map(key => state.resources[key]),
        get: state => key => state.resources[key],
        index(state, getters) {
            const index = {
                mods: [],
                resourcepacks: [],
            }
            for (const val of getters.values) {
                index[val.domain].push(val);
            }
            return index;
        },
        mods: (state, getters) => getters.index.mods,
        resourcepacks: (state, getters) => getters.index.resourcepacks,
    },
    mutations: {
        rename(context, { resource, name }) { resource.name = name; },
        /**
         * @param {Resource[]} payload 
         */
        resources: (state, payload) => {
            payload.forEach((res) => { Vue.set(state.resources, res.hash, res) })
        },
        delete(state, payload) { Vue.delete(state.resources, payload); },
    },
    actions: {
        /**
         * @param {ActionContext} context 
         */
        async load(context) {
            const files = await context.dispatch('readFolder', { path: `${context.rootGetters.root}/resources` }, { root: true });
            const contents = []
            for (const file of files.filter(f => f.endsWith('.json'))) {
                try {
                    contents.push(await context.dispatch('read', { // eslint-disable-line
                        path: `${context.state.root}/${file}`,
                        fallback: undefined,
                        encoding: 'json',
                    }, { root: true }))
                } catch (e) { console.warn(e) }
            }
            context.commit('resources', contents)
        },
        save(context, { mutation, object }) {
        },
        /**
         * @param {ActionContext} context 
         * @param {string|Resource} resource 
         */
        delete(context, resource) {
            if (typeof resource === 'string') {
                resource = context.state.resources[resource];
            }
            context.commit('delete', resource.hash)
            return context.dispatch('delete', { path: `resources/${resource.hash}.json` }, { root: true })
                .then(() => context.dispatch('delete', { path: `resources/${resource.hash}${resource.type}` }, { root: true }))
        },
        /**
        * @param {ActionContext} context 
        * @param {{resource:string|Resource, name:string}} payload
        */
        rename(context, payload) {
            if (typeof payload.resource === 'string') payload.resource = context.state.resources[payload.resource];
            if (!payload) throw new Error('Cannot find resource');
            context.commit('rename', payload);
            return context.dispatch('write', { path: `resources/${payload.resource.hash}.json`, data: JSON.stringify(payload.resource) }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         * @param {string[]|string} files 
         */
        import(context, files) {
            return context.dispatch('query',
                {
                    service: 'repository',
                    action: 'import',
                    payload: { root: context.rootGetters.root, files },
                }, { root: true })
                .then((resources) => { context.commit('resources', resources) })
        },

        /**
         * @param {ActionContext} context 
         * @param {{resource:string|Resource, minecraft:string}} payload 
         */
        link(context, payload) {
            const { resource, minecraft } = payload

            /**
            * @type {Resource}
            */
            let res;
            if (typeof resource === 'string') res = context.state.resources[resource]
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            return context.dispatch('export', {
                file: `resources/${res.hash}${res.type}`,
                toFolder: `${minecraft}/${res.domain}`,
                mode: 'link',
                name: `${res.hash}${res.type}`,
            }).then(() => res);
        },
        /**
         * @param {ActionContext} context 
         * @param {{resource:string|Resource, targetDirectory:string}} payload 
         */
        export(context, payload) {
            const { resource, targetDirectory } = payload

            /**
            * @type {Resource}
            */
            let res;
            if (typeof resource === 'string') res = context.state.resources[resource]
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            return context.dispatch('export', {
                file: `resources/${res.hash}${res.type}`,
                toFolder: targetDirectory,
                mode: 'copy',
                name: `${res.hash}${res.type}`,
            }).then(() => res);
        },
        refresh(context, payload) {
        },
    },
}

import * as fs from 'fs-extra'
import * as path from 'path'
import crypto from 'crypto'
import Vue from 'vue'
import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: () => ({
        mods: {},
        resourcepacks: {},
    }),
    getters: {
        domains: state => Object.keys(state),
        mods: state => Object.keys(state.mods).map(k => state.mods[k]) || [],
        resourcepacks: state => Object.keys(state.resourcepacks)
            .map(k => state.resourcepacks[k]) || [],
        getResource: (state, getters) => (hash) => {
            for (const domain of getters.domains) {
                if (state[domain][hash]) return state[domain][hash];
            }
            return undefined;
        },
    },
    mutations: {
        rename(context, { resource, name }) { resource.name = name; },
        /**
         * @param {Resource[]} payload 
         */
        resources: (state, payload) => {
            payload.forEach((res) => {
                if (!state[res.domain]) Vue.set(state, res.domain, {})
                Vue.set(state[res.domain], res.hash, res);
            })
        },
        remove(state, resource) { Vue.delete(state[resource.domain], resource.hash); },
    },
    actions: {
        /**
         * @param {ActionContext} context 
         */
        async load(context) {
            const files = await context.dispatch('readFolder', { path: 'resources' }, { root: true });
            const contents = []
            for (const file of files.filter(f => f.endsWith('.json'))) {
                try {
                    contents.push(await context.dispatch('read', { // eslint-disable-line
                        path: `resources/${file}`,
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
        remove(context, resource) {
            if (typeof resource === 'string') {
                resource = context.getters.getResource(resource)
            }
            context.commit('remove', resource)
            return Promise.all([
                context.dispatch('delete', { path: `resources/${resource.hash}.json` }, { root: true }),
                context.dispatch('delete', { path: `resources/${resource.hash}${resource.type}` }, { root: true }),
            ])
        },
        /**
        * @param {ActionContext} context 
        * @param {{resource:string|Resource, name:string}} payload
        */
        rename(context, payload) {
            if (typeof payload.resource === 'string') payload.resource = context.getters.getResource(payload.resource);
            if (!payload) throw new Error('Cannot find resource');
            context.commit('rename', payload);
            return context.dispatch('write', { path: `resources/${payload.resource.hash}.json`, data: JSON.stringify(payload.resource) }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         * @param {string[]|string| {signiture:any, files:string|string[]}} files 
         */
        import(context, files) {
            const data = {
                files: [],
                signiture: {
                    source: 'local',
                    date: Date.now(),
                    meta: null,
                },
            }
            if (files instanceof Array) {
                data.files = files;
                data.signiture.meta = files;
            } else if (typeof files === 'string') {
                data.files = [files]
                data.signiture.meta = files;
            } else {
                if (!files.files || files.files == null || !(files.files instanceof Array)) throw new Error('Illegal Argument format!')
                if (!files.signiture || files.signiture == null) throw new Error('Have to have a signiture to import!')
                data.files = files.files;
                data.signiture = files.signiture
            }
            if (data.files.length === 0) return Promise.resolve();
            return context.dispatch('query',
                {
                    service: 'repository',
                    action: 'import',
                    payload: { root: context.rootGetters.root, files: data },
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
            if (typeof resource === 'string') res = context.getters.getResource(resource)
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
            if (typeof resource === 'string') res = context.getters.getResource(resource)
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

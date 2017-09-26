import fs from 'fs-extra'
import paths from 'path'
import { ActionContext } from 'vuex'

export default {
    actions: {
        /**
         * 
         * @param {ActionContext} context 
         * @param {{path:string}} payload 
         */
        readFolder(context, payload) {
            let { path } = payload;
            if (!path) throw new Error('Path must not be undefined!')
            path = paths.join(context.rootGetters.root, path);
            return fs.ensureDir(path).then(() => fs.readdir(path));
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{path:string}} payload 
         */
        delete(context, payload) {
            let { path } = payload;
            path = paths.join(context.rootGetters.root, path);
            return new Promise((resolve, reject) => {
                if (!fs.existsSync(path)) resolve()
                else resolve(fs.remove(path))
            });
        },
        /**
          * @param {ActionContext} context 
          * @param {{file:string, toFolder:string, name:string}} payload 
          */
        import(context, payload) {
            const { file, toFolder, name } = payload;
            const to = context.rootGetters.path(toFolder, name || paths.basename(file))
            return fs.copy(file, to)
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{ file:string, toFolder:string, name:string, mode:string }} payload 
         */
        export(context, payload) {
            const { file, toFolder, name, mode } = payload;
            const $mode = mode || 'copy';
            const from = context.rootGetters.path(file)
            const to = paths.join(toFolder, name || paths.basename(file))
            if ($mode === 'link') return fs.link(from, to)
            return fs.copy(from, to)
        },
        /**
         * @param {ActionContext} context 
         * @param {{path:string,data:Buffer|string|any}} payload 
         */
        write(context, payload) {
            let { path, data } = payload;
            path = paths.resolve(context.rootState.root, path)
            if (typeof data === 'object' && !(data instanceof Buffer)) data = JSON.stringify(data)
            const parent = paths.dirname(path)
            return fs.ensureDir(parent).then(() => fs.writeFile(path, data))
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{paths:string[]}} payload 
         */
        exist(context, payload) {
            for (const p of payload.paths) if (!fs.existsSync(p)) return false
            return true
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{path:string, fallback:string|Buffer, encoding:'string'|'json'|((buf:Buffer)=>any), onread:(path:string)=>void}} payload
         */
        async read(context, payload) {
            let { path, fallback } = payload;
            const { encoding, onread } = payload;
            path = paths.join(context.rootGetters.root, path)
            if (!fs.existsSync(path)) {
                if (fallback) return fallback;
                throw new Error(`No such file ${path}`);
            }
            if (onread) onread(path);
            try {
                const data = await fs.readFile(path)
                if (!encoding) return data;
                if (typeof encoding === 'function') return encoding(data);
                switch (encoding) {
                    case 'string': return data.toString();
                    case 'json': return JSON.parse(data.toString());
                    default:
                        console.warn(`Unsupported encoding ${encoding}!`);
                        return data;
                }
            } catch (e) {
                if (fallback) {
                    if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback);
                    await fs.writeFile(path, fallback);
                    return fallback;
                }
                throw e;
            }
        },
    },
}

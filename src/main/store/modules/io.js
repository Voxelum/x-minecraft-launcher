import { app } from 'electron';
import paths, { join } from 'path';
import { Task } from '@xmcl/minecraft-launcher-core';
import Ajv from 'ajv';
import { createContext, runInContext } from 'vm';
import fs from 'main/utils/vfs';
import { getGuardWindow } from '../../windowsManager';

/**
 * @type {{[url: string]: Promise<string>}}
 */
const downloadingGuard = {};
/**
 * @type {import('universal/store/modules/io').IOModule}
 */
const mod = {
    actions: {
        async readFolder(context, path) {
            if (!path) throw new Error('Path must not be undefined!');
            path = paths.join(context.rootState.root, path);
            await fs.ensureDir(path);
            return fs.readdir(path);
        },

        async setPersistence(context, { path, data }) {
            const inPath = `${context.rootState.root}/${path}`;
            return fs.writeFile(inPath, JSON.stringify(data, null, 4), { encoding: 'utf-8' });
        },

        async getPersistence(context, { path, schema }) {
            const inPath = `${context.rootState.root}/${path}`;
            if (await fs.missing(inPath)) return undefined;
            const read = await fs.readFile(inPath, { encoding: 'utf-8' }).then(s => JSON.parse(s.toString())).catch(() => { });
            if (read && schema) {
                const schemaObject = await fs.readFile(join(__static, 'persistence-schema', `${schema}.json`)).then(s => JSON.parse(s.toString()));
                const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
                const validation = ajv.compile(schemaObject);
                const valid = validation(read);
                if (!valid) {
                    const context = createContext({ object: read });
                    if (validation.errors) {
                        const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                        runInContext(cmd.join('\n'), context);
                    }
                }
            }
            return read;
        },
        async electronDownloadFile(context, payload) {
            const win = getGuardWindow();
            if (!win) {
                throw new Error('Downloader Not Ready');
            }
            win.webContents.downloadURL(payload.url);
            return new Promise((resolve, reject) => {
                win.webContents.session.once('will-download', (event, item, contents) => {
                    const savePath = join(app.getPath('userData'), 'temps', item.getFilename());
                    if (!item.getSavePath()) item.setSavePath(savePath);
                    const downloadTask = Task.create('download', context => new Promise((resolve, reject) => {
                        item.on('updated', (e) => {
                            context.update(item.getReceivedBytes(), item.getTotalBytes(), item.getURL());
                        });
                        item.on('done', ($event, state) => {
                            switch (state) {
                                case 'completed':
                                    resolve(savePath);
                                    break;
                                case 'cancelled':
                                case 'interrupted':
                                default:
                                    reject(new Error(state));
                                    break;
                            }
                        });
                    }));
                    context.dispatch('executeTask', downloadTask)
                        .then(handle => resolve(handle));
                });
            });
        },
    },
};

export default mod;

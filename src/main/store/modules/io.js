import { Task } from '@xmcl/minecraft-launcher-core';
import Ajv from 'ajv';
import { app } from 'electron';
import fs from 'main/utils/vfs';
import paths, { join } from 'path';
import { createContext, runInContext } from 'vm';
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

        async setPersistence(context, { path, data, schema }) {
            const inPath = `${context.rootState.root}/${path}`;
            const deepCopy = JSON.parse(JSON.stringify(data));
            if (schema) {
                const schemaObject = await fs.readFile(join(__static, 'persistence-schema', `${schema}.json`)).then(s => JSON.parse(s.toString()));
                const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
                const validation = ajv.compile(schemaObject);
                const valid = validation(deepCopy);
                if (!valid) {
                    throw new Error(`Cannot persistence the ${path} as input invalid!`);
                }
            }
            return fs.writeFile(inPath, JSON.stringify(deepCopy, null, 4), { encoding: 'utf-8' });
        },

        async getPersistence(context, { path, schema }) {
            const inPath = `${context.rootState.root}/${path}`;
            if (await fs.missing(inPath)) return undefined;
            const originalString = await fs.readFile(inPath, { encoding: 'utf-8' }).then(b => b.toString()).catch(() => '{}');
            const object = JSON.parse(originalString);
            if (object && schema) {
                const schemaObject = await fs.readFile(join(__static, 'persistence-schema', `${schema}.json`)).then(s => JSON.parse(s.toString()));
                const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
                const validation = ajv.compile(schemaObject);
                const valid = validation(object);
                if (!valid) {
                    console.warn(`Found invalid config file on ${path}.`);
                    const context = createContext({ object });
                    if (validation.errors) {
                        validation.errors.forEach(e => console.warn(e));
                        const cmd = validation.errors.map(e => `delete object${e.dataPath};`);
                        runInContext(cmd.join('\n'), context);
                    }
                    console.warn('Try to remove those invalid keys. This might cause problem.');
                    console.warn(originalString);
                    console.warn('VS');
                    console.warn(JSON.stringify(object, null, 4));
                }
            }
            return object;
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

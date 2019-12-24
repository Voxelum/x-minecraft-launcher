import { writeFile, readFile, createWriteStream } from 'fs-extra';
import { join } from 'path';
import { getRawIfUpdate } from '@xmcl/installer/util';
import { Script } from 'vm';
import got from 'got';
import { net, Session } from 'electron';
import { LauncherAppController } from './LauncherAppController';

// async function getIfUpdate(session: Session, url: string, timestamp: string) {
//     const req = net.request({
//         url,
//         session,
//     });
//     req.setHeader('If-Modified-Since', timestamp);
//     req.on('response', (r) => {
//         const lastModified = r.headers['last-modified'];
//     });
//     req.end();
// }

export class AppLoader {
    constructor(readonly name: string, readonly cacheRoot: string, private host: string) {
    }

    async loadController() {
        let host = this.host;

        let timestamp = '';
        let content = '';

        const getUpdatePromise = host ? getRawIfUpdate(`${host}/index.js`, timestamp).catch(e => ({ content: undefined })) : Promise.resolve({ content: undefined });
        const cachePromise = readFile(join(this.cacheRoot, 'index.js')).then((b) => b.toString(), () => '');

        const result = await getUpdatePromise;
        if (result.content) {
            content = result.content;
            writeFile(join(this.cacheRoot, 'index.js'), content);
        } else {
            content = await cachePromise;
        }

        if (!content) {
            throw new Error('Cannot Read Controller: Neither remote server or local cache exists!');
        }

        const script = new Script(content);

        const context = {
            module: {
                exports: {
                    default: undefined,
                },
            },
        };

        script.runInNewContext(context);

        return context.module.exports.default as unknown as LauncherAppController;
    }

    async ensureAssetFile(path: string) {
        let host = this.host;


        const cacheMetadata = join(this.cacheRoot, `${path}.cache`);
        const timestamp = await readFile(cacheMetadata).then((b) => b.toString(), () => '');

        const req = async () => {
            const { headers, statusCode, body } = await got(`${host}/index.js`, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.87 Safari/537.36 Edg/80.0.361.48',
                    'If-Modified-Since': timestamp,
                },
                responseType: 'buffer',
            });
            if (statusCode === 304) {
                return { content: undefined, timestamp: headers['last-modified'] || '' };
            }
            return { content: body, timestamp: headers['last-modified'] || '' };
        };
        const { content, timestamp: newTimestamp } = await req();
        if (content) {
            await writeFile(join(this.cacheRoot, path), content);
            await writeFile(cacheMetadata, newTimestamp || timestamp);
        }
    }

    /**
     * Load file to buffer, which will be used for icon image
     */
    async loadAssetFile(path: string) {
        let host = this.host;
        let timestamp = '';

        const req = async () => {
            const { headers, statusCode, body } = await got(`${host}/index.js`, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.87 Safari/537.36 Edg/80.0.361.48',
                    'If-Modified-Since': timestamp,
                },
                responseType: 'buffer',
            });
            if (statusCode === 304) {
                return { content: undefined, timestamp: headers['last-modified'] || '' };
            }
            return { content: body, timestamp: headers['last-modified'] || '' };
        };
        const getUpdatePromise = host ? req() : Promise.resolve({ content: undefined });
        const cachePromise = readFile(join(this.cacheRoot, path)).catch(() => undefined);

        let content: Buffer | undefined;
        const result = await getUpdatePromise;
        if (result.content) {
            content = result.content;
        } else {
            content = await cachePromise;
        }

        return content;
    }
}

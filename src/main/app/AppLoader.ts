import { exists } from '@main/util/fs';
import { createHash } from 'crypto';
import { readFile, stat, writeFile } from 'fs-extra';
import got from 'got';
import { join } from 'path';
import { Script } from 'vm';
import { LauncherAppController } from './LauncherAppController';

export class AppLoader {
    constructor(private host: string, private cacheRoot: string) {
    }

    async hasUpdate(url: string, timestamp: string) {
        let res = await got.head(url, { headers: { 'last-modified': timestamp } });
        return res.statusCode !== 304;
    }

    async fetch(url: string, timestamp: string) {
        if (await this.hasUpdate(url, timestamp)) {
            return got(url).buffer();
        }
    }

    async checkIfUpdate(url: string, timestamp: string) {

    }

    async load(url: string): Promise<Buffer> {
        let sha1 = createHash('sha1').update(url).digest('base64');

        let cachePath = join(this.cacheRoot, sha1);
        let cacheTimestampPath = join(this.cacheRoot, `${sha1}.timestamp`);

        if (await exists(cachePath)) {
            let cacheBuf = await readFile(cachePath);
            let timestamp = (await readFile(cacheTimestampPath)).toString();

            this.checkIfUpdate(url, timestamp);

            return cacheBuf;
        } else {

        }
        let reqPromise = got(url);
        let resp = await reqPromise;
        let newTimestamp = resp.headers['last-modified'];
        let buf = await got(url).buffer();
        writeFile(cachePath, buf);
        return buf;
        try {
            let s = await stat(cachePath);
            return readFile(cachePath);
        } catch (e) {
            return remoteResult;
            // TODO: request
        }
    }

    async loadController() {
        let host = this.host;

        let timestamp = '';
        let content = '';

        const getUpdatePromise = host ? this.load(`${host}/index.js`, timestamp).catch(e => ({ content: undefined })) : Promise.resolve({ content: undefined });
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

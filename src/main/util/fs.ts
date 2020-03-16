import { checksum } from '@xmcl/core/fs';
import { FSWatcher, readdir, watch, stat, ensureDir } from 'fs-extra';

export * from '@xmcl/core/fs';

export function isDirectory(file: string) {
    return stat(file).then((s) => s.isDirectory(), () => false);
}
export function isFile(file: string) {
    return stat(file).then((s) => s.isFile(), () => false);
}
export async function readdirIfPresent(path: string) {
    if (!path) throw new Error('Path must not be undefined!');
    await ensureDir(path);
    return readdir(path).catch((e) => {
        if (e.code === 'ENOENT') return [];
        throw e;
    });
}
export async function readdirEnsured(path: string) {
    if (!path) throw new Error('Path must not be undefined!');
    await ensureDir(path);
    return readdir(path);
}
export function validateSha256(path: string, sha256: string) {
    return checksum(path, 'sha256').then(s => s === sha256, () => false);
}

export class FileStateWatcher<T> {
    private watcher: FSWatcher | undefined;

    private state: T;

    private watching: string | undefined;

    // eslint-disable-next-line no-useless-constructor
    constructor(private defaultState: T, private handler: (state: T, event: string, file: string) => T) {
        this.state = defaultState;
    }

    public watch(file: string) {
        if (this.watching === file) return false;
        if (this.watcher) { this.watcher.close(); }
        this.watcher = watch(file, (event, file) => {
            this.state = this.handler(this.state, event, file);
        });
        return true;
    }

    public getStateAndReset() {
        const state = this.state;
        this.state = this.defaultState;
        return state;
    }
}

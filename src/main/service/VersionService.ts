import { FileStateWatcher, readdirEnsured } from '@main/util/fs';
import { LocalVersion } from '@universal/store/modules/version';
import { Version } from '@xmcl/core';
import { remove } from 'fs-extra';
import Service from './Service';


/**
 * The local version serivce maintains the installed versions on disk
 */
export default class VersionService extends Service {
    private runtimeDetectors: { [runtime: string]: (version: Version) => string } = {};

    private versionsWatcher = new FileStateWatcher([] as string[], (state, _, f) => [...state, f]);

    registerVersionProvider(runtime: string, parser: (version: Version) => string) {
        this.runtimeDetectors[runtime] = parser;
    }

    constructor() {
        super();
        this.registerVersionProvider('forge', (v) => v.libraries.find(l => l.name.startsWith('net.minecraftforge:forge:'))
            ?.name.split(':')[2]?.split('-')?.[1] || '');
        this.registerVersionProvider('liteloader', (v) => v.libraries.find(l => l.name.startsWith('com.mumfrey:liteloader:'))
            ?.name.split(':')[2] || '');
        this.registerVersionProvider('fabric-loader', (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:fabric-loader:'))
            ?.name.split(':')[2] || '');
        this.registerVersionProvider('yarn', (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:yarn:'))
            ?.name.split(':')[2] || '');
    }

    async load() {
        await this.refreshVersions(true);
    }

    async init() {
        this.versionsWatcher.watch(this.getGameAssetsPath('versions'));
    }

    protected async parseVersion(versionFolder: string): Promise<LocalVersion> {
        const resolved = await Version.parse(this.state.root, versionFolder);
        const minecraft = resolved.minecraftVersion;
        const version: { [key: string]: string } = {
            id: resolved.id,
            minecraft,
            folder: versionFolder,
        };
        for (const [runtime, parser] of Object.entries(this.runtimeDetectors)) {
            version[runtime] = parser(resolved);
        }
        return version as any as LocalVersion;
    }

    /**
     * Refresh a version in the version folder.
     * @param versionFolder The version folder name. It must existed under the `versions` folder.
     */
    async refreshVersion(versionFolder: string) {
        try {
            const version = await this.parseVersion(versionFolder);
            this.commit('localVersion', version);
        } catch (e) {
            this.commit('localVersionRemove', versionFolder);
            this.warn(`An error occured during refresh local version ${versionFolder}`);
            this.warn(e);
        }
    }

    async refreshVersions(force?: boolean) {
        /**
        * Read local folder
        */
        let files: string[];
        if (force) {
            files = await readdirEnsured(this.getGameAssetsPath('versions'));
        } else {
            files = this.versionsWatcher.getStateAndReset();
        }

        if (files.length === 0) return;

        const versions: LocalVersion[] = [];
        for (const versionId of files.filter(f => !f.startsWith('.'))) {
            try {
                const version = await this.parseVersion(versionId);
                versions.push(version);
            } catch (e) {
                this.warn(`An error occured during refresh local version ${versionId}`);
                this.warn(e);
            }
        }
        this.commit('localVersions', versions);
    }

    async deleteVersion(version: string) {
        const path = this.getGameAssetsPath('versions', version);
        await remove(path);
        this.commit('localVersions', this.state.version.local.filter(v => v.folder !== version));
    }

    async showVersionsDirectory() {
        const path = this.getGameAssetsPath('versions');
        return this.appManager.openDirectory(path);
    }

    async showVersionDirectory(version: string) {
        const path = this.getGameAssetsPath('versions', version);
        return this.appManager.openDirectory(path);
    }
}

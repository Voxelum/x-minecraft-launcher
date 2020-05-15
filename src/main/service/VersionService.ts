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

    private versionsWatcher = new FileStateWatcher([] as string[], (state, _, f) => [...new Set([...state, f])]);

    private versionLoaded = false;

    registerVersionProvider(runtime: string, parser: (version: Version) => string) {
        this.runtimeDetectors[runtime] = parser;
    }

    constructor() {
        super();
        this.registerVersionProvider('forge', (v) => v.libraries.find(l => l.name.startsWith('net.minecraftforge:forge:'))
            ?.name.split(':')[2]?.split('-')?.[1] || '');
        this.registerVersionProvider('liteloader', (v) => v.libraries.find(l => l.name.startsWith('com.mumfrey:liteloader:'))
            ?.name.split(':')[2] || '');
        this.registerVersionProvider('fabricLoader', (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:fabric-loader:'))
            ?.name.split(':')[2] || '');
        this.registerVersionProvider('yarn', (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:yarn:'))
            ?.name.split(':')[2] || '');
    }

    async load() {
        await this.refreshVersions();
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


    async resolveVersionId() {
        let cur = this.getters.instanceVersion;
        if (cur.folder === 'unknown') {
            await this.refreshVersions(true);
        }
        return cur.folder;
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
        let patch = false;
        if (force) {
            files = await readdirEnsured(this.getGameAssetsPath('versions'));
        } else if (this.versionLoaded) {
            patch = true;
            files = this.versionsWatcher.getStateAndReset();
        } else {
            files = await readdirEnsured(this.getGameAssetsPath('versions'));
        }

        files = files.filter(f => !f.startsWith('.'));

        let versions: LocalVersion[] = [];
        for (let versionId of files) {
            try {
                versions.push(await this.parseVersion(versionId));
            } catch (e) {
                this.warn(`An error occured during refresh local version ${versionId}`);
                this.warn(e);
            }
        }

        if (versions.length !== 0) {
            if (patch) {
                for (let version of versions) {
                    this.commit('localVersion', version);
                }
            } else {
                this.commit('localVersions', versions);
            }
            this.log(`Found ${versions.length} local game versions.`);
        } else if (patch) {
            this.log('No new version found.');
        } else {
            this.log('No local game version found.');
        }
        this.versionLoaded = true;
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

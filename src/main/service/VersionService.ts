import { FileStateWatcher, readdirEnsured } from '@main/util/fs';
import { LocalVersion, resolveRuntimeVersion } from '@universal/entities/version';
import { Version } from '@xmcl/core';
import { remove } from 'fs-extra';
import Service from './Service';


/**
 * The local version serivce maintains the installed versions on disk
 */
export default class VersionService extends Service {
    private versionsWatcher = new FileStateWatcher([] as string[], (state, _, f) => [...new Set([...state, f])]);

    private versionLoaded = false;

    async dispose() {
        this.versionsWatcher.close();
    }

    async load() {
        await this.refreshVersions();
    }

    async init() {
        this.versionsWatcher.watch(this.getPath('versions'));
    }

    public async resolveLocalVersion(versionFolder: string, root: string = this.state.root): Promise<LocalVersion> {
        const resolved = await Version.parse(root, versionFolder);
        const minecraft = resolved.minecraftVersion;
        const version: LocalVersion = {
            id: resolved.id,
            minecraft,
            folder: versionFolder,
            fabricLoader: '',
            forge: '',
            liteloader: '',
            yarn: '',
        };
        resolveRuntimeVersion(resolved, version);
        return version;
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
            const version = await this.resolveLocalVersion(versionFolder);
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
            files = await readdirEnsured(this.getPath('versions'));
        } else if (this.versionLoaded) {
            patch = true;
            files = this.versionsWatcher.getStateAndReset();
        } else {
            files = await readdirEnsured(this.getPath('versions'));
        }

        files = files.filter(f => !f.startsWith('.'));

        let versions: LocalVersion[] = [];
        for (let versionId of files) {
            try {
                versions.push(await this.resolveLocalVersion(versionId));
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
        const path = this.getPath('versions', version);
        await remove(path);
        this.commit('localVersions', this.state.version.local.filter(v => v.folder !== version));
    }

    async showVersionsDirectory() {
        const path = this.getPath('versions');
        return this.app.openDirectory(path);
    }

    async showVersionDirectory(version: string) {
        const path = this.getPath('versions', version);
        return this.app.openDirectory(path);
    }
}

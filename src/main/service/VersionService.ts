import { Util, Version } from '@xmcl/minecraft-launcher-core';
import { shell } from 'electron';
import { remove } from 'fs-extra';
import { fs, getExpectVersion, requireString } from 'main/utils';
import { readFolder } from 'main/utils/persistence';
import { LocalVersion } from 'universal/store/modules/version';
import Service from './Service';

/**
 * The local version serivce maintains the installed versions on disk
 */
export default class VersionService extends Service {
    async load() {
        await this.refreshVersions();
    }

    async refreshVersions() {
        /**
        * Read local folder
        */
        const files = await readFolder(this.getPath('versions'));

        if (files.length === 0) return;

        const versions = [];
        for (const versionId of files.filter(f => !f.startsWith('.'))) {
            try {
                const resolved = await Version.parse(this.state.root, versionId);
                const minecraft = resolved.client;
                const forge = resolved.libraries.filter(l => l.name.startsWith('net.minecraftforge:forge'))
                    .map(l => l.name.split(':')[2].split('-')[1])[0] || '';
                const liteloader = resolved.libraries.filter(l => l.name.startsWith('com.mumfrey:liteloader'))
                    .map(l => l.name.split(':')[2])[0] || '';

                versions.push({
                    forge,
                    liteloader,
                    id: resolved.id,
                    minecraft,
                    folder: versionId,
                });
            } catch (e) {
                console.error(`An error occured during refresh local version ${versionId}`);
                console.error(e);
            }
        }
        this.commit('localVersions', versions);
    }

    /**
     * Resolve a local existed version to its spec
     * @param targetVersion 
     */
    async resolveVersion(targetVersion: Pick<LocalVersion, 'minecraft' | 'forge' | 'liteloader'>) {
        requireString(targetVersion.minecraft);

        const localVersions = this.state.version.local;

        if (!targetVersion.forge && !targetVersion.liteloader) {
            const v = localVersions.find(v => v.minecraft === targetVersion.minecraft);
            if (!v) {
                const err = {
                    type: 'MissingMinecraftVersion',
                    version: targetVersion.minecraft,
                };
                throw err;
            }
            return targetVersion.minecraft;
        }
        if (targetVersion.forge && !targetVersion.liteloader) {
            const forge = localVersions.find(v => v.forge === targetVersion.forge && !v.liteloader);
            if (!forge) {
                const err = {
                    type: 'MissingForgeVersion',
                    version: targetVersion.forge,
                };
                throw err;
            }
            return forge.folder;
        }
        if (targetVersion.liteloader && !targetVersion.forge) {
            const liteloader = localVersions.find(v => v.liteloader === targetVersion.liteloader && !v.forge);
            if (!liteloader) {
                const err = {
                    type: 'MissingLiteloaderVersion',
                    version: targetVersion.liteloader,
                };
                throw err;
            }
            return liteloader.folder;
        }
        if (targetVersion.liteloader && targetVersion.forge) {
            const v = localVersions.find((v => v.liteloader === targetVersion.liteloader && v.forge === targetVersion.forge));
            if (v) { return v.folder; }
            const forge = localVersions.find(v => v.forge === targetVersion.forge);
            const liteloader = localVersions.find(v => v.liteloader === targetVersion.liteloader);

            if (!forge) {
                const err = {
                    type: 'MissingForgeVersion',
                    version: targetVersion.forge,
                };
                throw err;
            }
            if (!liteloader) {
                const err = {
                    type: 'MissingLiteloaderVersion',
                    version: targetVersion.liteloader,
                };
                throw err;
            }

            const root = new Util.MinecraftFolder(this.state.root);
            const targetId = getExpectVersion(targetVersion.minecraft, targetVersion.forge, targetVersion.liteloader);

            const extended = Version.extendsVersion(targetId,
                await Version.parse(root, forge.folder), await Version.parse(root, liteloader.folder));

            const targetJSON = root.getVersionJson(targetId);

            await fs.ensureFile(targetJSON);
            await fs.writeFile(targetJSON, JSON.stringify(extended, null, 4));

            return targetId;
        }

        throw new Error('');
    }

    async deleteVersion(version: string) {
        const path = this.getPath('versions', version);
        if (await fs.exists(path)) {
            await remove(path);
        }
        this.commit('localVersions', this.state.version.local.filter(v => v.folder !== version));
    }

    async showVersionsDirectory() {
        const path = this.getPath('versions');
        return shell.openItem(path);
    }

    async showVersionDirectory(version: string) {
        const path = this.getPath('versions', version);
        return shell.openItem(path);
    }
}

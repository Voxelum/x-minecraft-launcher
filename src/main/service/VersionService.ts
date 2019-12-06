import { Util, Version } from '@xmcl/minecraft-launcher-core';
import { fs, getExpectVersion, requireString } from 'main/utils';
import { readFolder, setPersistence } from 'main/utils/persistence';
import { LocalVersion } from 'universal/store/modules/version';
import { shell } from 'electron';
import Service from './Service';

/**
 * The local version serivce maintains the installed versions on disk
 */
export default class VersionService extends Service {
    async load() {
        await this.refreshVersions();
    }

    async save({ mutation }: { mutation: string }) {
        switch (mutation) {
            case 'minecraftMetadata':
                await setPersistence({
                    path: this.getPath('version.json'),
                    data: this.state.version.minecraft,
                });
                break;
            case 'forgeMetadata':
                await setPersistence({
                    path: this.getPath('forge-versions.json'),
                    data: this.state.version.forge,
                });
                break;
            case 'liteloaderMetadata':
                await setPersistence({
                    path: this.getPath('lite-versions.json'),
                    data: this.state.version.liteloader,
                });
                break;
            default:
        }
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

            const extended = await Version.extendsVersion(targetId,
                await Version.parse(root, forge.folder), await Version.parse(root, liteloader.folder));

            const targetJSON = root.getVersionJson(targetId);

            await fs.ensureFile(targetJSON);
            await fs.writeFile(targetJSON, JSON.stringify(extended, null, 4));

            return targetId;
        }

        throw new Error('');
    }

    async deleteVersion(version: string) {
        if (await fs.exists(this.getPath('versions', version))) {
            await fs.remove(this.getPath('versions', version));
        }
        this.commit('localVersions', this.state.version.local.filter(v => v.folder !== version));
    }

    async showVersionsDirectory() {
        shell.openItem(this.getPath('versions'));
    }

    async showVersionDirectory(version: string) {
        shell.openItem(this.getPath('versions', version));
    }
}

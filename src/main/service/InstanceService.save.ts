import { LevelDataFrame, WorldReader } from '@xmcl/minecraft-launcher-core';
import { createHash } from 'crypto';
import filenamify from 'filenamify';
import { compressZipTo, fs, includeAllToZip, notNull, requireString, unpack7z } from 'main/utils';
import { basename, join, resolve } from 'path';
import { ZipFile } from 'yazl';
import InstanceService from './InstanceService';

export async function loadAllProfileSaves(this: InstanceService) {
    const all: Array<{ profile: string; path: string; name: string; icon: string }> = [];
    for (const profile of this.getters.profiles) {
        const saveRoot = this.getPath('profiles', profile.id, 'saves');
        if (await fs.exists(saveRoot)) {
            const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));
            const loaded = await Promise.all(saves.map(s => resolve(saveRoot, s)));
            all.push(...loaded.filter(notNull).map(s => ({
                profile: profile.name,
                path: s,
                name: basename(s),
                icon: `file://${join(s, 'icon.png')}`,
            })));
        }
    }
    return all;
}

export async function loadProfileSaves(this: InstanceService, id: string = this.state.profile.id) {
    const { state, commit } = this;
    if (!this.isSavesDirty) {
        return state.profile.saves;
    }
    this.isSavesDirty = false;
    try {
        const saveRoot = this.getPathUnder(id, 'saves');

        if (await fs.exists(saveRoot)) {
            const saves = await fs.readdir(saveRoot).then(a => a.filter(s => !s.startsWith('.')));

            const loaded = await Promise.all(saves.map(s => resolve(saveRoot, s)).map(async (p) => {
                const reader = await WorldReader.create(p);
                return { path: p, level: await reader.getLevelData().catch(() => undefined) };
            }));
            const nonNulls: {
                path: string;
                level: LevelDataFrame;
            }[] = loaded.filter(s => !!s.level) as any;
            console.log(`Loaded ${nonNulls.length} saves.`);
            commit('profileSaves', nonNulls);
            return nonNulls;
        }
    } catch (e) {
        if (!e.message.startsWith('ENOENT:')) {
            console.warn(`An error ocurred during parsing the save of ${id}`);
            console.warn(e);
        }
    }
    commit('profileSaves', []);
    return [];
}
/**
 * Import a save from a `zip` or `folder`.
 * @param filePath 
 */
export async function importSave(this: InstanceService, filePath: string) {
    requireString(filePath);

    const { getters, commit, state } = this;
    async function hasLevel(dir: string) { return fs.exists(join(dir, 'level.dat')); }
    async function findLevelDir(dir: string): Promise<string | undefined> {
        if (await hasLevel(dir)) return dir;
        for (const sub of await fs.readdir(dir)) {
            const subLevel = await findLevelDir(join(dir, sub));
            if (subLevel) return subLevel;
        }
        return undefined;
    }
    try {
        const stat = await fs.stat(filePath);
        let srcDir = filePath;
        if (!stat.isDirectory()) {
            const tempName = createHash('sha1').update(filePath).digest('hex');
            srcDir = this.getPath('temp', tempName); // save will unzip to the /saves
            await unpack7z(filePath, srcDir);
        }
        const levelRoot = await findLevelDir(srcDir);
        if (!levelRoot) throw new Error(`The ${filePath} does not contain a Minecraft save!`);

        const reader = await WorldReader.create(levelRoot);
        const level = await reader.getLevelData();
        const fileName = filenamify(level.LevelName);

        let destDir = this.getPath('profiles', state.profile.id, 'saves', fileName);
        await fs.ensureFile(destDir);
        while (await fs.exists(destDir)) {
            destDir += ' Copy';
        }
        await fs.copy(srcDir, destDir);
        commit('profileSaves', [...state.profile.saves, { path: filePath, level }]);
        await this.loadProfileSaves();
    } catch (e) {
        console.error(`Cannot import save from ${filePath}`);
        console.error(e);
        throw e;
    }
}
/**
 * Copy current profile `src` save to other profile. The `dest` is the array of profile id. 
 */
export async function copySave(this: InstanceService, { src, dest }: { src: string; dest: string[] }) {
    const id = this.state.profile.id;
    const path = src;
    const saveName = basename(path);
    if (!path || await fs.missing(path)) {
        console.log(`Cancel save copying of ${path}`);
        return;
    }
    const expect = this.getPath('profiles', id, 'saves', saveName);
    if (path === expect) { // confirm this save is a select profile's save
        await Promise.all(
            dest.map(p => this.getPath('profiles', p, 'saves', saveName))
                .map(p => fs.copy(expect, p)),
        );
    } else {
        console.error(`Cannot copy map ${path}, which is not in selected profile ${id}`);
    }
}
/**
 * Delete a save in current instance
 * @param name The name of the save
 */
export async function deleteSave(this: InstanceService, name: string) {
    requireString(name);

    console.log(`Start remove save from ${name}`);
    const id = this.state.profile.id;
    const saveName = basename(name);
    if (!name || await fs.missing(name)) {
        console.log(`Cancel map removing of ${name}`);
        return;
    }
    const expect = this.getPath('profiles', id, 'saves', saveName);
    if (name === expect) { // confirm this save is a select profile's save
        await fs.remove(name);
        process.nextTick(() => this.loadProfileSaves());
    } else {
        console.error(`Cannot remove map ${name}, which is not in selected profile ${id}`);
    }
    console.log(`Removed save from ${name}`);
}
/**
 * Export the save as a zip or a directory
 */
export async function exportSave(this: InstanceService, payload: {
    /**
     * The save name under current profile
     */
    path: string;
    /**
     * The destination full path
     */
    destination: string;
    /**
     * Should export as zip
     */
    zip?: boolean;
}) {
    const { path, zip, destination } = payload;
    console.log(`Export map from ${path} to ${destination}.`);

    async function transferFile(src: string, dest: string) {
        if (!zip) {
            return fs.copy(src, dest);
        }
        const zipFile = new ZipFile();
        const promise = compressZipTo(zipFile, dest);
        await includeAllToZip(src, src, zipFile);
        zipFile.end();
        return promise;
    }

    if (path) {
        try {
            const stat = await fs.stat(destination);
            const dest = stat.isDirectory() ? join(destination, basename(path)) : destination;
            await fs.ensureFile(destination);
            await transferFile(path, dest);
        } catch (e) {
            await fs.ensureFile(destination);
            await transferFile(path, destination);
        }
    }
}

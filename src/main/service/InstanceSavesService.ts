import { copyPassively, exists, FileStateWatcher, isFile, missing, readdirIfPresent } from '@main/util/fs';
import { compressZipTo, includeAllToZip, unpack7z } from '@main/util/zip';
import { SaveMetadata } from '@universal/store/modules/instance';
import { requireString, requireObject } from '@universal/util/assert';
import { Exception } from '@universal/util/exception';
import { createHash } from 'crypto';
import filenamify from 'filenamify';
import { ensureDir, ensureFile, readdir, remove } from 'fs-extra';
import { basename, join, resolve } from 'path';
import { ZipFile } from 'yazl';
import Service, { ServiceException } from './Service';

export interface ExportSaveOptions {
    /**
     * The instance directory path, e.g. the path of .minecraft folder.
     * 
     * This will be the active instance by default.
     */
    instancePath?: string;
    /**
     * The save folder name to export.
     */
    saveName: string;
    /**
     * The destination full file path.
     */
    destination: string;
    /**
     * Should export as zip
     * @default true
     */
    zip?: boolean;
}

export interface ImportSaveOptions {
    /**
     * The source path of the zip or folder of the save to import
     */
    source: string;
    /**
     * The destination instance directory path, e.g. the path of .minecraft folder.
     * 
     * This will be the active instance by default.
     */
    instancePath?: string;
    /**
     * The destination save folder name will be imported into.
     * 
     * It will be the basename of the source file path if this is not present.
     */
    saveName?: string;
}

export interface DeleteSaveOptions {
    /**
     * The save name will be deleted
     */
    saveName: string;

    /**
     * The instance path of this save. If this is not presented, it will use selected instance.
     */
    instancePath?: string;
}

export interface CloneSaveOptions {
    /**
     * The source instance path. If it is not presented, it will use selected instance.
     */
    srcInstancePath?: string;

    /**
     * The destination instance path. If it is not presented, it will use selected instance.
     */
    destInstancePath?: string | string[];

    /**
     * The save name to clone
     */
    saveName: string;

    /**
     * The new save name.
     * @default Generated name from the `saveName`
     */
    newSaveName?: string;
}

function getSaveMetadata(path: string, instanceName: string) {
    return {
        path,
        instanceName,
        name: basename(path),
        icon: `file://${join(path, 'icon.png')}`,
    };
}

/**
 * A 
 */
export default class InstanceSavesService extends Service {
    protected watcher = new FileStateWatcher(false, () => true);

    /**
     * Load all registered instances' saves metadata
     */
    async loadAllInstancesSaves() {
        let all: Array<SaveMetadata> = [];

        for (let instance of this.getters.instances) {
            let saveRoot = join(instance.path, 'saves');
            let saves = await readdirIfPresent(saveRoot).then(a => a.filter(s => !s.startsWith('.')));
            let metadatas = saves
                .map(s => resolve(saveRoot, s))
                .map((p) => getSaveMetadata(p, instance.name));
            all.push(...metadatas);
        }
        return all;
    }

    /**
     * Mount and load instances saves
     * @param path 
     */
    async mountInstanceSaves(path: string) {
        requireString(path);

        if (!this.state.instance.all[path]) {
            throw new Error();
        }

        let savesDir = join(path, 'saves');

        await ensureDir(savesDir);

        this.log(`Watch saves directory: ${savesDir}`);
        if (!this.watcher.watch(savesDir) && !this.watcher.getStateAndReset()) {
            return;
        }

        try {
            let savePaths = await readdir(savesDir);

            let result = savePaths
                .filter((d) => !d.startsWith('.'))
                .map((d) => join(savesDir, d))
                .map((p) => getSaveMetadata(p, this.getters.instance.name));

            this.log(`Found ${result.length} saves in instance ${path}.`);
            if (result.length !== 0) {
                this.commit('instanceSaves', result);
            }
        } catch (e) {
            throw new ServiceException({ type: 'fsError', ...e }, `An error ocurred during parsing the save of ${path}`);
        }
    }

    /**
     * Clone a save under an instance to one or multiple instances.
     *   
     * @param options 
     */
    async cloneSave(options: CloneSaveOptions) {
        let { srcInstancePath, destInstancePath, saveName, newSaveName } = options;

        requireString(saveName);

        srcInstancePath = srcInstancePath ?? this.state.instance.path;
        destInstancePath = destInstancePath ?? [this.state.instance.path];

        let destSaveName = newSaveName ?? saveName;

        let destInstancePaths = typeof destInstancePath === 'string' ? [destInstancePath] : destInstancePath;

        let srcSavePath = join(srcInstancePath, saveName);

        if (await missing(srcSavePath)) {
            throw new ServiceException({ type: 'instanceCopySaveNotFound', src: srcSavePath, dest: destInstancePaths }, `Cancel save copying of ${saveName}`);
        }
        if (!this.state.instance.all[srcInstancePath]) {
            throw new Error(`Cannot find managed instance ${srcInstancePath}`);
        }
        if (destInstancePaths.some(p => !this.state.instance.all[p])) {
            throw new Error(`Cannot find managed instance ${srcInstancePath}`);
        }

        let destSavePaths = destInstancePaths.map(d => join(d, destSaveName));

        for (let dest of destSavePaths) {
            await copyPassively(srcSavePath, dest);
        }
    }

    /**
     * Delete a save in a specific instance.
     * 
     * @param options 
     */
    async deleteSave(options: DeleteSaveOptions) {
        let { saveName, instancePath } = options;

        instancePath = instancePath ?? this.state.instance.path;

        requireString(saveName);

        if (!this.state.instance.all[instancePath]) {
            throw new Error(); // TODO: decorate error
        }

        let savePath = join(instancePath, saveName);

        if (await missing(savePath)) {
            throw new Exception({ type: 'instanceDeleteNoSave', name: saveName });
        }

        await remove(savePath);
    }

    /**
     * Import a zip or folder save to the target instance.
     * 
     * If the instancePath is not presented in the options, it will use the current selected instancePath.
     */
    async importSave(options: ImportSaveOptions) {
        /**
         * Find the directory contains the level.dat 
         */
        async function findLevelDatRoot(dir: string): Promise<string | undefined> {
            if (await exists(join(dir, 'level.dat'))) return dir;
            for (let subdir of await readdir(dir)) {
                let result = await findLevelDatRoot(join(dir, subdir));
                if (result) return result;
            }
            return undefined;
        }

        let { source, instancePath, saveName } = options;

        requireString(source);

        saveName = saveName ?? basename(source);
        instancePath = instancePath ?? this.state.instance.path;

        if (!this.state.instance.all[instancePath]) {
            throw new Error(`Cannot find managed instance ${instancePath}`);
        }

        // normalize the save name
        saveName = filenamify(saveName);

        let sourceDir = source;
        let destinationDir = join(instancePath, 'saves', saveName);
        let useTemp = false;

        if (await isFile(source)) {
            let hash = createHash('sha1').update(source).digest('hex');
            sourceDir = this.getPath('temp', hash); // save will unzip to the /saves
            await unpack7z(source, sourceDir);
            useTemp = true;
        }

        // validate the source
        let levelRoot = await findLevelDatRoot(sourceDir);
        if (!levelRoot) {
            throw new Exception({ type: 'instanceImportIllegalSave', path: source });
        }

        await copyPassively(sourceDir, destinationDir);

        if (useTemp) {
            await remove(sourceDir);
        }

        return destinationDir;
    }

    /**
     * Export a save from a managed instance to an external location.
     * 
     * You can choose export the save to zip or a folder.
     * 
     * @param options 
     */
    async exportSave(options: ExportSaveOptions) {
        requireObject(options);

        let { instancePath = this.state.instance.path, saveName, zip = true, destination } = options;

        requireString(saveName);
        requireString(destination);

        let source = join(instancePath, saveName);

        if (!this.state.instance.all[instancePath]) {
            throw new Error(`Cannot find managed instance ${instancePath}`);
        }

        if (await missing(instancePath)) {
            throw new Error(`Cannot find managed instance ${instancePath}`);
        }

        this.log(`Export save from ${instancePath}:${saveName} to ${destination}.`);

        if (!zip) {
            // copy to folder
            await ensureDir(destination);
            await copyPassively(source, destination);
        } else {
            // compress to zip
            await ensureFile(destination);
            let zipFile = new ZipFile();
            let promise = compressZipTo(zipFile, destination);
            await includeAllToZip(source, destination, zipFile);
            zipFile.end();
            await promise;
        }
    }
}

import { exists, isDirectory } from '@main/util/fs';
import { InstanceSave, InstanceSaveMetadata } from '@universal/entities/save';
import { FileSystem } from '@xmcl/system';
import { WorldReader } from '@xmcl/world';
import { readdir } from 'fs-extra';
import { basename, join } from 'path';

export async function findLevelRoot(fs: FileSystem, path: string): Promise<string | undefined> {
    if (path !== '' && !(await fs.isDirectory(path))) return undefined;
    if (await fs.existsFile([path, 'level.dat'].join(fs.sep))) return path;
    for (let subdir of await fs.listFiles(path)) {
        if (subdir === '') continue;
        let result = await findLevelRoot(fs, join(path, subdir));
        if (result) return result;
    }
    return undefined;
}

/**
 * Find the directory contains the level.dat 
 */
export async function findLevelRootOnPath(path: string): Promise<string | undefined> {
    if (!(await isDirectory(path))) return undefined;
    if (await exists(join(path, 'level.dat'))) return path;
    for (let subdir of await readdir(path)) {
        let result = await findLevelRootOnPath(join(path, subdir));
        if (result) return result;
    }
    return undefined;
}


/**
 * Get the instance save preview information
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export function getInstanceSave(path: string, instanceName: string): InstanceSave {
    return {
        path,
        instanceName,
        name: basename(path),
        icon: `file://${join(path, 'icon.png')}`,
    };
}

/**
 * Load the instance save metadata
 *
 * @param path The path of the save directory
 * @param instanceName The instance name
 */
export async function loadInstanceSaveMetadata(path: string, instanceName: string): Promise<InstanceSaveMetadata> {
    const reader = await WorldReader.create(path);
    const level = await reader.getLevelData();
    return {
        path,
        instanceName,
        mode: level.GameType,
        name: basename(path),

        levelName: level.LevelName,
        icon: `file://${join(path, 'icon.png')}`,
        gameVersion: level.Version.Name,
        difficulty: level.Difficulty,
        cheat: false,
        lastPlayed: level.LastPlayed.toNumber(),
    };
}

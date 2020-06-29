import { FileSystem } from '@xmcl/system';
import { join } from 'path';

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

import { promises, createWriteStream } from 'fs';
import { join, relative } from 'path';
import { ZipFile } from 'yazl';
import { unpack } from '7zip-min';

export async function includeAllToZip(root: string, real: string, zip: ZipFile) {
    const relativePath = relative(root, real);
    const stat = await promises.stat(real);
    if (stat.isDirectory()) {
        const files = await promises.readdir(real);
        if (relativePath !== '') {
            zip.addEmptyDirectory(relativePath);
        }
        await Promise.all(files.map(f => includeAllToZip(root, join(real, f), zip)));
    } else if (stat.isFile()) {
        zip.addFile(real, relativePath);
    }
}
export function compressZipTo(zip: ZipFile, dest: string) {
    return new Promise<void>((resolve, reject) => {
        zip.outputStream.pipe(createWriteStream(dest))
            .on('close', () => { resolve(); })
            .on('error', (e) => { reject(e); });
    });
}
export function unpack7z(pathToArchive: string, whereToUnpack: string) {
    return new Promise<void>((resolve, reject) => {
        unpack(pathToArchive, whereToUnpack, (e) => { if (e) reject(e); else resolve(); });
    });
}

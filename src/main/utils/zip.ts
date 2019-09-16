import { promises, createWriteStream } from 'fs';
import { join, relative } from 'path';
import { ZipFile } from 'yazl';

/**
 * @param {string} root
 * @param {string} real
 * @param {ZipFile} zip
 */
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


/**
 * @param {ZipFile} zip
 * @param {string} dest
 */
export function compressZipTo(zip: ZipFile, dest: string) {
    return new Promise((resolve, reject) => {
        zip.outputStream.pipe(createWriteStream(dest))
            .on('close', () => { resolve(); })
            .on('error', (e) => { reject(e); });
    });
}

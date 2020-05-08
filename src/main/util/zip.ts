import { promises, createWriteStream, Stats } from 'fs';
import { join, relative } from 'path';
import { ZipFile } from 'yazl';
import { unpack } from '7zip-min';
import { gunzip as _gunzip } from 'zlib';
import { promisify } from 'util';
import { task } from '@xmcl/task';
import { stat } from 'fs-extra';

export async function includeAllToZip(root: string, real: string, zip: ZipFile, addFileCb?: (fileStat: Stats) => void) {
    const relativePath = relative(root, real);
    const stat = await promises.stat(real);
    if (stat.isDirectory()) {
        const files = await promises.readdir(real);
        if (relativePath !== '') {
            zip.addEmptyDirectory(relativePath);
        }
        await Promise.all(files.map(f => includeAllToZip(root, join(real, f), zip, addFileCb)));
    } else if (stat.isFile()) {
        if (addFileCb) {
            addFileCb(stat);
        }
        zip.addFile(real, relativePath);
    }
}

export const gunzip: (data: Buffer) => Promise<Buffer> = promisify(_gunzip);

export function openCompressedStream(zip: ZipFile, dest: string) {
    return new Promise<void>((resolve, reject) => {
        zip.outputStream.pipe(createWriteStream(dest))
            .on('close', () => { resolve(); })
            .on('error', (e) => { reject(e); });
    });
}

export function openCompressedStreamTask(dest: string) {
    let update: () => void = () => { };
    let zip: ZipFile = new ZipFile();
    let total = 0;
    let progress = 0;
    let t = task('compress', async (ctx) => {
        update = () => {
            ctx.update(progress, total, dest);
        };
        ctx.pausealbe(() => {

        }, () => {
            
        });
        update();
        return new Promise<void>((resolve, reject) => {
            zip.outputStream.on('data', (chunk) => {
                progress += chunk.length;
                update();
            });
            zip.outputStream.pipe(createWriteStream(dest))
                .on('close', () => { resolve(); })
                .on('error', (e) => { reject(e); });
        });
    });

    function include(root: string, real: string) {
        return includeAllToZip(root, real, zip, (s) => {
            total += s.size;
            update();
        });
    }
    async function add(filePath: string, metaPath: string) {
        let fStat = await stat(filePath);
        if (fStat.isDirectory()) {
            return;
        }
        total += fStat.size;
        zip.addFile(filePath, metaPath);
    }
    function end() {
        zip.end();
        update();
    }
    return {
        task: t,
        include,
        add,
        end,
    };
}

export function unpack7z(pathToArchive: string, whereToUnpack: string) {
    return new Promise<void>((resolve, reject) => {
        unpack(pathToArchive, whereToUnpack, (e) => { if (e) reject(e); else resolve(); });
    });
}
export function unpackGarGz() {

}

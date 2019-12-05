// import { Util } from '@xmcl/minecraft-launcher-core';
import vfs from 'fs-extra'
import { createHash } from 'crypto';

export const fs = {
    ...vfs,
    exists(p: string) { return vfs.stat(p).then(() => true, () => false) },
    missing(p: string) { return vfs.stat(p).then(() => false, () => true) },
    validate(p: string, option: { algorithm: string; hash: string }) {
        return new Promise<string>((resolve, reject) => {
            const hash = createHash(option.algorithm).setEncoding("hex");
            vfs.createReadStream(p)
                .pipe(hash)
                .on("error", (e) => { reject(e); })
                .once("finish", () => { resolve(hash.read() as string); });
        }).then(s => s === option.hash);
    }
};


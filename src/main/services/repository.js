import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'

import { Mod, ResourcePack } from 'ts-minecraft'

/**
 * 
 * @param {string} root 
 * @param {string} filePath 
 * @param {(Buffer)=>any} parser 
 */
async function $import(root, filePath, parser) {
    const [name, data, type] = await fs.readFile(filePath)
        .then($data => [path.basename(filePath), $data, path.extname(filePath)]);
    const hash = crypto.createHash('sha1').update(data).digest('hex').toString('utf-8');
    const dataFile = `${hash}${type}`
    const metaFile = `${hash}.json`
    if (fs.existsSync(dataFile) && fs.existsSync(metaFile)) return undefined;
    let meta
    try {
        meta = parser(name, data, type);
    } catch (e) {
        return Promise.reject(e)
    }
    const resource = { hash, name, type, meta };
    await fs.writeFile(path.join(root, `${resource.hash}${resource.type}`), data);
    await fs.writeFile(path.join(root, `${resource.hash}.json`), resource);
    return resource;
}

const parsers = {
    resourcepack: (name, data, type) => ResourcePack.read(name, data),
    mod: (name, data, type) => Mod.parse(data),
}

export default {
    initialize() { },
    proxy: {
        /**
         * 
         * @param {string} type 
         * @param {(name:string, data:Buffer, type:string)} parser 
         */
        register(type, parser) {
            if (parsers[type]) throw new Error(`Duplicated type ${type}`);
            if (typeof parser !== 'function') throw new Error('The parser has to be a function!');
            parsers[type] = parser;
        },
    },
    actions: {
        /**
         * @param {string} root 
         * @param {{hash:string,type:string}} resource 
         * @param {string} targetDirectory 
         */
        export(root, resource, targetDirectory) {
            return fs.copy(`${root}/${resource.hash}${resource.type}`, `${targetDirectory}/${resource.hash}${resource.type}`)
        },
        /**
         * 
         * @param {string} root 
         * @param {string[]} files 
         * @param {string} metaType 
         */
        async import(root, files, metaType) {
            if (!root || !metaType || !files) throw new Error('Import require root location, files, and a specific meta type!')
            const parser = parsers[metaType]
            if (!parser) throw new Error(`Unknown meta type ${metaType}`)
            return (await Promise.all(files.map(f => $import(root, f, parser))))
                .filter(res => res !== undefined)
        },
    },
}

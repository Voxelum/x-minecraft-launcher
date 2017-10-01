import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import { Mod, ResourcePack } from 'ts-minecraft'


/**
 * @type {ResourceParser[]}
 */
const parsers = [
    { domain: 'mods', parse: (name, data, type) => Mod.parse(data) },
    { domain: 'resourcepacks', parse: (name, data, type) => ResourcePack.read(name, data) },
];

/**
 * 
 * @param {string} root 
 * @param {string} filePath 
 */
async function $import(root, filePath) {
    const data = await fs.readFile(filePath);
    const name = path.basename(filePath);
    const type = path.extname(filePath);
    const hash = crypto.createHash('sha1').update(data).digest('hex').toString('utf-8');
    const dataFile = `${hash}${type}`
    const metaFile = `${hash}.json`
    if (fs.existsSync(dataFile) && fs.existsSync(metaFile)) return undefined;
    let meta
    let domain
    for (const parser of parsers) {
        try {
            meta = parser.parse(name, data, type);
            if (meta instanceof Promise) meta = await meta; // eslint-disable-line
            domain = parser.domain;
            break;
        } catch (e) { console.warn(e) }
    }
    const resource = { hash, name, type, meta, domain };
    await fs.ensureDir(path.join(root, 'resources'))
    await fs.writeFile(path.join(root, 'resources', `${resource.hash}${resource.type}`), data);
    await fs.writeFile(path.join(root, 'resources', `${resource.hash}.json`), JSON.stringify(resource));
    return resource;
}


export default {
    initialize() {

    },
    proxy: {
        /**
         * 
         * @param {string} domain 
         * @param {(name:string, data:Buffer, type:string)} parser 
         */
        register(domain, parser) {
            parsers.push({ domain, parse: parser })
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
         * @param {{root:string, string[]|string:files}} payload
         */
        async import(payload) {
            const { root } = payload;
            let files = payload.files
            if (!root || !files) throw new Error(`Import require root location, files, and a specific meta type! ${root}, ${files}`)

            if (typeof files === 'string') files = [files]
            else if (!(files instanceof Array)) { return Promise.reject('Illegal Type') }

            return (await Promise.all(files.map(f => $import(root, f))))
                .filter(res => res !== undefined)
        },
    },
}

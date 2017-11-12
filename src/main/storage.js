import fs from 'fs-extra'

export default async (root) => {
    await fs.ensureDir(`${root}/Store`);
    const files = await fs.readdir(`${root}/Store`);
    const virtualfs = {};
    const discoverFile = async (virtual, file) => {
        const stat = await fs.stat(file);
        if (stat.isDirectory()) {
            const child = await fs.readdir(file);
            await Promise.all(child.map(f => discoverFile(virtual, f)))
        } else {
            virtual[file] = (await fs.readFile(file)).toString() 
        }
    }
    await Promise.all(files.map(file => discoverFile(virtualfs, file)))
    return virtualfs
}

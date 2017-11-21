import fs from 'fs-extra'
import path from 'path'

export default async (root) => {
    await fs.ensureDir(`${root}/Store`);
    const files = await fs.readdir(`${root}/Store`);
    const virtualfs = {};
    const discoverFile = async (virtual, file) => {
        const stat = await fs.stat(file);
        if (stat.isDirectory()) {
            const child = await fs.readdir(file);
            await Promise.all(child.map(f => discoverFile(virtual, `${file}/${f}`)))
        } else if (file.endsWith('.json')) virtual[path.relative(`${root}/Store`, file.substring(0, file.length - 5))] = (await fs.readFile(file)).toString()
    }
    await Promise.all(files.map(file => discoverFile(virtualfs, `${root}/Store/${file}`)))
    return virtualfs
}

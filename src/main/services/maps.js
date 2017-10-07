import Zip from 'jszip'
import fs from 'fs-extra'
import paths from 'path'

const allFiles = folder =>
    fs.readdirSync(folder)
        .map(file => (fs.lstatSync(`${folder}/${file}`).isDirectory() ? allFiles(`${folder}/${file}`) : [`${folder}/${file}`]))
        .reduce((left, right) => [...left, ...right], []);

export default {
    initialize() { },
    proxy: {},
    actions: {
        /**
         * 
         * @param {{root:string, map:string, toFolder: string, zip:boolean}} payload 
         */
        async export(payload) {
            const srcMap = paths.join(payload.root, payload.map)
            if (payload.zip) {
                const targetZip = paths.join(payload.toFolder, `${payload.map}.zip`);
                const zip = new Zip();
                await Promise.all(allFiles(srcMap).map(file =>
                    fs.readFile(file).then(buf => zip.file(paths.relative(srcMap, file), buf)),
                ))
                return fs.writeFile(targetZip, await zip.generateAsync({ type: 'nodebuffer' }));
            }
            const targetFolder = paths.join(payload.toFolder, payload.map);
            return fs.copy(srcMap, targetFolder)
        },
    },

}

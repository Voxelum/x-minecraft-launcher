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
        async import(context, payload) {

        },
        /**
         * 
         * @param {{map:string, exportName:string, zip:boolean}} payload 
         */
        async export(context, payload) {
            const { map, exportName } = payload;
            if (payload.zip) {
                const targetZip = exportName;
                const zip = new Zip();
                await Promise.all(allFiles(map).map(file =>
                    fs.readFile(file).then(buf => zip.file(paths.relative(map, file), buf)),
                ))
                return fs.writeFile(targetZip, await zip.generateAsync({ type: 'nodebuffer' }));
            }
            return fs.copy(map, exportName)
        },
    },

}

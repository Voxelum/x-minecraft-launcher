import path from 'path';
import fs from 'fs-extra';
import Zip from 'jszip';

export default {
    actions: {
        /**
         * 
         * @param {*} context 
         * @param {{from:string, to:string}} payload 
         */
        async compressTo(context, payload) {
            const { from, to } = payload;
            const stat = await fs.stat(from);
            if (!stat.isDirectory()) {
                const zip = Zip();
            }
        },
    },
}

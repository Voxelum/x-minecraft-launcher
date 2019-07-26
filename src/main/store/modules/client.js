import base from 'universal/store/modules/client';
import fs from 'fs';
import { join } from 'path';

/**
 * @type {import('universal/store/modules/client').ClientModule}
 */
const mod = {
    ...base,
    actions: {
        async load(context) {
            const protocolFile = context.rootGetters.path('protocol.json');
            if (fs.existsSync(protocolFile)) {
                const buf = await fs.promises.readFile(protocolFile);
                const object = JSON.parse(buf.toString());
                if (object.eTag) {
                    // request server for new one
                }
                /**
                 * @type any
                 */
                const mcversionMapping = {};
                for (const [mc, prot] of Object.values(object.protocol)) {
                    if (!mcversionMapping[mc]) mcversionMapping[mc] = [];
                    mcversionMapping[mc].push(prot);
                }
                context.commit('protocolMapping', {
                    protocol: object.protocol,
                    mcversion: mcversionMapping,
                });
            } else {
                const rev = await fs.promises.readFile(join(__static, 'protocol.json'))
                    .then(b => b.toString()).then(JSON.parse);
                const forward = await fs.promises.readFile(join(__static, 'mc-protocol.json'))
                    .then(b => b.toString()).then(JSON.parse);

                context.commit('protocolMapping', {
                    protocol: forward,
                    mcversion: rev,
                });
            }
        },
    },
};

export default mod;

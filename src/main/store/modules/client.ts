import base, { ClientModule } from 'universal/store/modules/client';
import { join } from 'path';
import { fs } from 'main/utils';

const mod: ClientModule = {
    ...base,
    actions: {
        async load(context) {
            const protocolFile = context.rootGetters.path('protocol.json');
            if (await fs.exists(protocolFile)) {
                const buf = await fs.readFile(protocolFile);
                const object = JSON.parse(buf.toString());
                if (object.eTag) {
                    // request server for new one
                }
                const mcversionMapping: any = {};
                for (const [mc, prot] of Object.entries(object.protocol)) {
                    if (!mcversionMapping[mc]) mcversionMapping[mc] = [];
                    mcversionMapping[mc].push(prot);
                }
                context.commit('protocolMapping', {
                    protocol: object.protocol,
                    mcversion: mcversionMapping,
                });
            } else {
                const rev = await fs.readFile(join(__static, 'protocol.json'))
                    .then(b => b.toString()).then(JSON.parse);
                const forward = await fs.readFile(join(__static, 'mc-protocol.json'))
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

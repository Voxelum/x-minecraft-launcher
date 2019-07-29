import { isCompatible } from 'universal/utils/versions';
/**
 * @type {import('./client').ClientModule}
 */
const mod = {
    state: {
        protocolMapping: {
            protocol: {},
            mcversion: {},
        },
        packFormatMapping: {
            mcversion: Object.freeze({
                1: '[1.6, 1.9)',
                2: '[1.9, 1.11)',
                3: '[1.11, 1.13)',
                4: '[1.13,]',
            }),
        },
    },
    getters: {
        isResourcePackCompatible: state => (format, mcversion) => isCompatible(mcversion,
            state.packFormatMapping.mcversion[format]),
    },
    mutations: {
        protocolMapping(state, p) {
            state.protocolMapping = Object.freeze(p);
        },
        packFormatMapping(state, m) {
            state.packFormatMapping = Object.freeze(m);
        },
    },
};

export default mod;

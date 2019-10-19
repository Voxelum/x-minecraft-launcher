import { isCompatible } from 'universal/utils/versions';
import { ModuleOption } from '../root';
import { LoadAction } from '..';

export type ProtocolToVersion = {
    [protocol: string]: string[];
};
export type PackFormatToVersioRange = {
    [range: string]: string;
};

export type MinecraftVersion = string;

export interface ResourcePackFormatMapping {
    mcversion: {
        [format: number]: string;
    };
}
export interface ClientProtocolMapping {
    protocol: {
        [mcversion: string]: number;
    };
    mcversion: {
        [protocol: number]: MinecraftVersion[];
    };
}

interface State {
    protocolMapping: ClientProtocolMapping;
    packFormatMapping: ResourcePackFormatMapping;
}

interface Getters {
    getAcceptMinecraftRangeByFormat: (format: number) => string;
    getAcceptMinecraftsByProtocol: (protocol: number) => string[];
    isResourcePackCompatible: (format: number, mcversion: string) => boolean;
}

interface Mutations {
    packFormatMapping: ResourcePackFormatMapping;
    protocolMapping: ClientProtocolMapping;
}

export type ClientModule = ModuleOption<State, Getters, Mutations, LoadAction>;

const mod: ClientModule = {
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
        getAcceptMinecraftRangeByFormat: state => format => state.packFormatMapping.mcversion[format] || '',
        getAcceptMinecraftsByProtocol: state => protocol => state.protocolMapping.mcversion[protocol] || [],
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

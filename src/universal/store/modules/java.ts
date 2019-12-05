import Vue from 'vue';
import { requireObject, requireString } from 'universal/utils/object';
import { ModuleOption } from '../root';
import { Java, JavaConfig } from './java.config';

interface State extends JavaConfig {
}

interface Getters {
    defaultJava: Java
    missingJava: boolean
}
interface Mutations {
    addJava: (Java | Java[]);
    removeJava: (Java);
    defaultJava: (Java);
}

export type JavaModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: JavaModule = {
    state: {
        all: [],
        default: 0,
    },
    getters: {
        defaultJava: state => state.all[state.default] || { path: '', version: '', majorVersion: 0 },
        missingJava: state => state.all.length === 0,
    },
    mutations: {
        addJava(state, java) {
            if (java instanceof Array) {
                for (const j of java) {
                    const existed = state.all.find(jp => jp.path === j.path);
                    if (existed) {
                        existed.majorVersion = j.majorVersion;
                        existed.version = j.version;
                    } else {
                        state.all.push(j);
                    }
                }
            } else {
                const existed = state.all.find(j => j.path === java.path);
                if (existed) {
                    existed.majorVersion = java.majorVersion;
                    existed.version = java.version;
                } else {
                    state.all.push(java);
                }
            }
            if (state.default >= state.all.length) state.default = 0;
        },
        removeJava(state, java) {
            requireObject(java);
            requireString(java.path);
            for (let i = 0; i < state.all.length; i++) {
                const j = state.all[i];
                if (j.path === java.path && j.version === java.version) {
                    Vue.delete(state.all, i);
                    if (state.all.length === 0) state.default = 0;
                    return;
                }
            }
        },
        defaultJava(state, def) {
            requireObject(def);
            requireString(def.path);

            const i = state.all.indexOf(def);
            if (i !== -1) {
                state.default = i;
            }
        },
    },
};

export { Java };

export default mod;

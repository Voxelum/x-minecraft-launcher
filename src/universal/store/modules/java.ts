import Vue from 'vue';
import { requireObject, requireString } from 'universal/utils/object';
import { ModuleOption } from '../root';
import { Java, JavaSchema } from './java.schema';

type State = JavaSchema

interface Getters {
    defaultJava: Java;
    missingJava: boolean;
}
interface Mutations {
    javaAdd: (Java | Java[]);
    javaRemove: (Java);
    javaSetDefault: (Java);
}

export type JavaModule = ModuleOption<State, Getters, Mutations, {}>;

/**
 * Return when there is no java
 */
export const DEFAULT_JAVA: Java = {
    version: '',
    majorVersion: 0,
    path: '',
};

const mod: JavaModule = {
    state: {
        all: [],
        default: 0,
    },
    getters: {
        defaultJava: state => state.all[state.default] || DEFAULT_JAVA,
        missingJava: state => state.all.length === 0,
    },
    mutations: {
        javaAdd(state, java) {
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
        javaRemove(state, java) {
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
        javaSetDefault(state, def) {
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

import { requireObject, requireString } from '@universal/util/assert';
import { remove } from '@universal/util/middleware';
import { ModuleOption } from '../root';
import { Java } from './java.schema';

type State = {
    all: JavaState[];
};

export type JavaState = Java & { valid: boolean };

interface Getters {
    defaultJava: JavaState;
    missingJava: boolean;
}
interface Mutations {
    javaUpdate: (JavaState | JavaState[]);
    javaRemove: (JavaState);
}

export type JavaModule = ModuleOption<State, Getters, Mutations, {}>;

/**
 * Return when there is no java
 */
export const EMPTY_JAVA: JavaState = {
    version: '',
    majorVersion: 0,
    path: '',
    valid: false,
};

const mod: JavaModule = {
    state: {
        all: [],
    },
    getters: {
        defaultJava: state => state.all.find(j => j.valid) || EMPTY_JAVA,
        missingJava: state => state.all.length === 0,
    },
    mutations: {
        javaUpdate(state, java) {
            if (java instanceof Array) {
                for (const j of java) {
                    const existed = state.all.find(jp => jp.path === j.path);
                    if (existed) {
                        existed.majorVersion = j.majorVersion;
                        existed.version = j.version;
                        existed.valid = j.valid;
                    } else {
                        state.all.push(j);
                    }
                }
            } else {
                const existed = state.all.find(j => j.path === java.path);
                if (existed) {
                    existed.majorVersion = java.majorVersion;
                    existed.version = java.version;
                    existed.valid = java.valid;
                } else {
                    state.all.push(java);
                }
            }
        },
        javaRemove(state, java) {
            requireObject(java);
            requireString(java.path);
            for (let i = 0; i < state.all.length; i++) {
                const j = state.all[i];
                if (j.path === java.path && j.version === java.version) {
                    state.all.splice(i, 1);

                    // TODO: remove in vue3
                    remove(state.all, i);

                    return;
                }
            }
        },
    },
};

export { Java };

export default mod;

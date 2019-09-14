import Vue from 'vue';
import { requireString, requireObject } from '../../utils/object';

import { Module, Context, TaskHandle } from "../store";
import { Java, JavaConfig } from './java.config';

export { Java };

export declare namespace JavaModule {
    interface State extends JavaConfig {

    }

    interface Getters {
        defaultJava: Java
        missingJava: boolean
    }
    interface Mutations {
        addJava(type: State, java: Java | Java[]): void
        removeJava(type: State, java: Java): void
        defaultJava(type: State, java: Java): void
    }
    type C = Context<State, Getters, Mutations, Actions>
    interface Actions {
        installJava(context: C, fix?: boolean): Promise<TaskHandle>
        refreshLocalJava(context: C): Promise<void>
        redirectToJvmPage(context: C): Promise<void>
        resolveJava(context: C, java: string): Promise<Java | undefined>
    }
}

export type JavaModule = Module<"java", JavaModule.State, JavaModule.Getters, JavaModule.Mutations, JavaModule.Actions>;

const mod: JavaModule = {
    state: {
        all: [],
        default: 0,
    },
    getters: {
        defaultJava: state => state.all[state.default],
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

export default mod;

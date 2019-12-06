import Vue from 'vue';
import { ModuleOption } from '../root';
import { Resource } from './resource';

export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks';

export interface DownloadFile {
    /**
     * The number id of the curseforge file 
     */
    id: number;
    name: string;
    href?: string;

    projectType: ProjectType;
    projectPath: string;
    projectId?: number;
}


interface State {
    downloading: { [href: string]: { download: DownloadFile; taskId: string } };
}

interface Getters {
    isFileInstalled: (file: { id: number; href: string }) => boolean;
    findFileInstalled: (file: { id: number; href: string }) => Resource<any> | undefined;
}

interface Mutations {
    startDownloadCurseforgeFile: { download: DownloadFile; taskId: string };
    endDownloadCurseforgeFile: DownloadFile;
}

export type CurseForgeModule = ModuleOption<State, Getters, Mutations, {}>;

const mod: CurseForgeModule = {
    state: {
        downloading: {},
    },
    getters: {
        isFileInstalled: (state, _, rt, rg) => (file) => {
            /**
             */
            const find = (m: { source: any }) => {
                const source = m.source;
                if ('curseforge' in source && typeof source.curseforge === 'object') {
                    const s = source.curseforge;
                    if (s.href === file.href || s.fileId === file.id) return true;
                }
                return false;
            };
            if (rg.mods.find(find)) return true;
            if (rg.resourcepacks.find(find)) return true;
            if (rg.modpacks.find(find)) return true;
            if (rg.saves.find(find)) return true;

            return false;
        },
        findFileInstalled: (state, _, rt, rg) => (file) => {
            /**
             */
            const find = (m: { source: any }) => {
                const source = m.source;
                if ('curseforge' in source && typeof source.curseforge === 'object') {
                    const s = source.curseforge;
                    if (s.href === file.href || s.fileId === file.id) return true;
                }
                return false;
            };
            let result;
            /* eslint-disable no-cond-assign */
            if (result = rg.mods.find(find)) return result;
            if (result = rg.resourcepacks.find(find)) return result;
            if (result = rg.modpacks.find(find)) return result;
            if (result = rg.saves.find(find)) return result;
            /* eslint-enable no-cond-assign */

            return undefined;
        },
    },
    mutations: {
        startDownloadCurseforgeFile(state, p) {
            Vue.set(state.downloading, p.download.id.toString(), p);
        },
        endDownloadCurseforgeFile(state, p) {
            Vue.delete(state.downloading, p.id.toString());
        },
    },
};

export default mod;

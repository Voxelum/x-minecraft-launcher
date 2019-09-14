import Vue from 'vue';
import { Context, Module, TaskHandle } from "../store";
import { Resource } from "./resource";

export declare namespace CurseForgeModule {
    interface State {
        downloading: { [href: string]: { download: DownloadFile, taskId: string } };
    }

    interface Getters {
        isFileInstalled: (file: Pick<Download, "id" | "href">) => boolean;
        findFileInstalled: (file: Pick<Download, "id" | "href">) => Resource<any> | undefined;
    }

    interface Mutations {
        startDownloadCurseforgeFile(state: State, payload: { download: DownloadFile, taskId: string }): void;
        endDownloadCurseforgeFile(state: State, download: DownloadFile): void;
    }

    type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks';

    interface DownloadFile {
        id: number;
        name: string;
        href: string;

        projectType: ProjectType;
        projectPath: string;
        projectId?: number;
    }

    interface Downloads {
        pages: number;
        versions: Version[];
        files: Download[];
    }
    interface Download {
        id: number;
        name: string;
        href: string;

        type: string;
        size: string;
        date: string;
        version: string;
        downloadCount: string;
    }
    interface ProjectPreview {
        name: string;
        title: string;
        author: string;
        description: string;
        updatedDate: string;
        createdDate: string;
        count: string;
        categories: {
            href: string;
            icon: string;
        }[];
        icon: string;
    }

    /**
     * Project detail info
     */
    interface Project {
        /**
         * Number id of the project
         */
        id: number;
        /**
         * mc-mods/jei, jei is the path
         */
        path: string;
        type: ProjectType;
        /**
         * Display name
         */
        name: string;
        /**
         * Image url
         */
        image: string;
        members: { icon: string, name: string, type: string }[];
        updatedDate: number;
        createdDate: number;
        totalDownload: string;
        license: { url: string, name: string };
        files: {
            /**
             * number id of the file
             */
            id: number;
            type: string;
            /**
             * Display name
             */
            name: string;
            date: number;

            href: string;
        }[];
        description: string;
    }

    interface Version {
        type: string;
        text: string;
        value: string;
    }
    interface Filter {
        text: string;
        value: string;
    }


    type C = Context<State, Getters, Mutations, Actions>;

    interface Modpack {
        manifestType: string;
        manifestVersion: number;
        minecraft: {
            version: string;
            libraries?: string;
            modLoaders: {
                id: string;
                primary: boolean;
            }[];
        };
        name: string;
        version: string;
        author: string;
        files: {
            projectID: number;
            fileID: number;
            required: boolean;
        }[];
        override: string;
    }

    interface Actions {
        fetchCurseForgeProjects(context: C, option?: { page?: string, version?: string, filter?: string, project: ProjectType }): Promise<{
            projects: ProjectPreview[], pages: number, versions: Version[], filters: Filter[]
        }>;

        /**
         * Query the project detail from path.
         */
        fetchCurseForgeProject(context: C, payload: { path: string, project: ProjectType }): Promise<Project>;

        /**
         * Query the project downloadable files.
         */
        fetchCurseForgeProjectFiles(context: C, payload?: { path: string, version?: string, page?: number, project: ProjectType | string }): Promise<Downloads>;

        /**
         * Fetch the curseforge images of a project
         */
        fetchCurseforgeProjectImages(context: C, payload: { path: string, type: string | ProjectType }): Promise<{ name: string, url: string, mini: string }[]>;

        /**
         * Fetch the license content from project license url
         */
        fetchCurseForgeProjectLicense(context: C, licenseUrl: string): Promise<string>;

        /**
         * Perform search under specific curseforge project type
         */
        searchCurseforgeProjects(context: C, payload: { keyword: string, type: string | ProjectType }): Promise<ProjectPreview[]>;

        importCurseforgeModpack(context: C, option: { profile: string, path: string }): Promise<TaskHandle>;

        downloadAndImportFile(context: C, payload: DownloadFile): Promise<TaskHandle>;
    }
}
export interface CurseForgeModule extends Module<"curseforge", CurseForgeModule.State, CurseForgeModule.Getters, CurseForgeModule.Mutations, CurseForgeModule.Actions> {
}


const mod: CurseForgeModule = {
    state: {
        downloading: {},
    },
    getters: {
        isFileInstalled: (state, _, rt, rg) => (file) => {
            /**
             */
            const find = (m: { source: any; }) => {
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
            const find = (m: { source: any; }) => {
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
            Vue.set(state.downloading, p.download.href, p);
        },
        endDownloadCurseforgeFile(state, p) {
            Vue.delete(state.downloading, p.href);
        },
    },
};

export default mod;

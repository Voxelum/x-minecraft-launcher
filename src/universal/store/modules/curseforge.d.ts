import { Context, Module, TaskHandle } from "../store";

export namespace CurseForgeModule {
    interface State {
        downloading: { [href: string]: { download: Download, taskId: string } };
    }

    interface Getters {
        isFileInstalled: (file: Pick<Download, "id" | "href">) => boolean;
    }

    interface Mutations {
        startDownloadCurseforgeFile(state: State, payload: { download: Download, taskId: string });
        endDownloadCurseforgeFile(state: State, download: Download);
    }

    interface Download {
        id: number;
        type: string;
        name: string;
        href: string;
        size: string;
        date: string;
        version: string;
        downloadCount: string;
    }
    interface Downloads {
        pages: number;
        versions: Version[];
        files: Download[];
    }

    interface ProjectPreview {
        id: string;
        path: string;
        name: string;
        author: string;
        description: string;
        date: string;
        count: string;
        categories: {
            href: string;
            icon: string;
        }[];
        icon: string;
    }

    interface Project {
        projectId: string;
        name: string;
        image: string;
        members: { icon: string, name: string, type: string }[];
        lastUpdate: string;
        createdDate: string;
        totalDownload: string;
        license: { url: string, name: string };
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
            projectId: number;
            fileId: number;
            required: boolean;
        }[];
        override: string;
    }

    type ProjectType = 'mc-mods' | 'texture-packs' | 'modpacks' | 'worlds';
    interface Actions {
        importCurseforgeModpack(context: C, path: string): Promise<TaskHandle>;
        fetchCurseForgeProjects(context: C, option?: { page?: string, version?: string, filter?: string, project: ProjectType }): Promise<{
            projects: ProjectPreview[], pages: number, versions: Version[], filters: Filter[]
        }>;

        /**
         * Query the project detail from path.
         */
        fetchCurseForgeProject(context: C, payload: { path: string, project: ProjectType | string }): Promise<Project>;

        /**
         * Query the project downloadable files.
         */
        fetchCurseForgeProjectFiles(context: C, payload?: { path: string, version?: string, page?: number, project: ProjectType | string }): Promise<Downloads>;

        fetchCurseforgeProjectImages(context: C, payload: { path: string, type: string | ProjectType }): Promise<{ name: string, url: string, mini: string }[]>;

        fetchCurseForgeProjectLicense(context: C, licenseUrl: string): Promise<string>;

        downloadAndImportFile(context: C, payload: { project: { path: string, type: string, id: string }, file: Download }): Promise<TaskHandle>;
    }
}
export interface CurseForgeModule extends Module<"curseforge", CurseForgeModule.State, CurseForgeModule.Getters, CurseForgeModule.Mutations, CurseForgeModule.Actions> {
}

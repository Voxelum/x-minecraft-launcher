import { Context, Module, TaskHandle } from "../store";
import { Resource } from "./resource";

export namespace CurseForgeModule {
    interface State {
        downloading: { [href: string]: { download: Download, taskId: string } };
    }

    interface Getters {
        isFileInstalled: (file: Pick<Download, "id" | "href">) => boolean;
        findFileInstalled: (file: Pick<Download, "id" | "href">) => Resource<any> | undefined;
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

    interface Project {
        id: string;
        name: string;
        image: string;
        members: { icon: string, name: string, type: string }[];
        updatedDate: string;
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
            projectID: number;
            fileID: number;
            required: boolean;
        }[];
        override: string;
    }

    type ProjectType = 'mc-mods' | 'texture-packs' | 'modpacks' | 'worlds';
    interface Actions {
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
        downloadAndImportFile(context: C, payload: { project: { path: string, type: string, id: string }, file: Download }): Promise<TaskHandle>;
    }
}
export interface CurseForgeModule extends Module<"curseforge", CurseForgeModule.State, CurseForgeModule.Getters, CurseForgeModule.Mutations, CurseForgeModule.Actions> {
}

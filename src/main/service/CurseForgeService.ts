import { File, getAddonDescription, getAddonFiles, getAddonInfo, getFeaturedAddons, GetFeaturedAddonOptions, searchAddons, SearchOptions, getCategories, Category, getCategoryTimestamp, AddonInfo, getAddonDatabaseTimestamp } from '@xmcl/curseforge';
import { Agent } from 'https';
import ResourceService from './ResourceService';
import Service, { Inject, Singleton } from './Service';

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

export interface Downloads {
    pages: number;
    versions: Version[];
    files: Download[];
}
export interface Download {
    id: number;
    name: string;
    href: string;

    type: string;
    size: string;
    date: string;
    version: string;
    downloadCount: string;
}
export interface ProjectPreview {
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
export interface Project {
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
    members: { icon: string; name: string; type: string }[];
    updatedDate: number;
    createdDate: number;
    totalDownload: string;
    license: { url: string; name: string };
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

export interface Version {
    type: string;
    text: string;
    value: string;
}
export interface Filter {
    text: string;
    value: string;
}

/**
 * The modpack metadata structure
 */
export interface Modpack {
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
    overrides: string;
}

export interface InstallFileOptions {
    file: File;

    type: 'modpack' | 'mod' | 'resourcepack' | 'save';
}

export default class CurseForgeService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    private userAgent: Agent = new Agent({ keepAlive: true });

    private projectTimestamp = '';

    private projectCache: Record<number, AddonInfo> = {};

    private projectDescriptionCache: Record<number, string> = {};

    private projectFilesCache: Record<number, File[]> = {};

    private searchProjectCache: Record<string, AddonInfo[]> = {};

    private async fetchOrGetFromCache<K extends string | number, V>(cache: Record<K, V>, key: K, query: () => Promise<V>) {
        // let timestamp = await getAddonDatabaseTimestamp({ userAgent: this.userAgent });
        if (!cache[key] /* || new Date(timestamp) > new Date(this.projectTimestamp) */) {
            let value = await query();
            // this.projectTimestamp = timestamp;
            cache[key] = value;
            // this.log(`Use catch ${}`)
            return value;
        }
        return cache[key];
    }

    @Singleton()
    async loadCategories() {
        let timestamp = await getCategoryTimestamp({ userAgent: this.userAgent });
        if (this.state.curseforge.categories.length === 0
            || new Date(timestamp) > new Date(this.state.curseforge.categoriesTimestamp)) {
            let cats = await getCategories({ userAgent: this.userAgent });
            cats = cats.filter((c) => c.rootGameCategoryId === null && c.gameId === 432);
            this.commit('curseforgeCategories', { categories: cats, timestamp });
        }
    }

    async fetchProject(projectId: number) {
        return this.fetchOrGetFromCache(this.projectCache, projectId, () => getAddonInfo(projectId, { userAgent: this.userAgent }));
    }

    fetchProjectDescription(projectId: number) {
        return this.fetchOrGetFromCache(this.projectDescriptionCache, projectId, () => getAddonDescription(projectId, { userAgent: this.userAgent }));
    }

    fetchProjectFiles(projectId: number) {
        return this.fetchOrGetFromCache(this.projectFilesCache, projectId, () => getAddonFiles(projectId, { userAgent: this.userAgent }));
    }

    async searchProjects(searchOptions: SearchOptions) {
        const addons = await this.fetchOrGetFromCache(this.searchProjectCache, JSON.stringify(searchOptions), () => searchAddons(searchOptions, { userAgent: this.userAgent }));
        for (let addon of addons) {
            this.projectCache[addon.id] = addon;
        }
        return addons;
    }

    fetchFeaturedProjects(getOptions: GetFeaturedAddonOptions) {
        return getFeaturedAddons(getOptions, { userAgent: this.userAgent });
    }

    async installFile({ file, type }: InstallFileOptions) {
        let task = this.resourceService.importResourceTask(file.downloadUrl, {
            curseforge: {
                projectId: file.projectId,
                fileId: file.id,
            },
        }, type);
        let handle = this.taskManager.submit(task);
        this.commit('curseforgeDownloadFileStart', { fileId: file.id, taskId: handle.root.id });
        try {
            await handle.wait();
        } finally {
            this.commit('curseforgeDownloadFileEnd', file.id);
        }
    }
}

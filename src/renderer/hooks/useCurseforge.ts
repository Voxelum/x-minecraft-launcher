import { Download, Filter, Project, ProjectPreview, ProjectType, Version } from '@main/service/CurseForgeService';
import { computed, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api';
import { File, AddonInfo } from '@xmcl/curseforge';
import { useService } from './useService';
import { useStore } from './useStore';

/**
 * Hook to view the curseforge project images.
 * @param path The project path 
 * @param type The project type
 */
export function useCurseforgeImages(path: string, type: ProjectType) {
    const { fetchCurseforgeProjectImages } = useService('CurseForgeService');
    const data: {
        images: { name: string; url: string; mini: string }[];
        refreshingImages: boolean;
    } = reactive({
        images: [],
        refreshingImages: false,
    });
    async function refreshImages() {
        data.refreshingImages = true;
        try {
            const images = await fetchCurseforgeProjectImages({
                type,
                path,
            });
            data.images = images;
        } finally {
            data.refreshingImages = false;
        }
    }
    return {
        ...toRefs(data),
        refreshImages,
    };
}

/**
 * Hook to view the curseforge project downloadable files.
 * @param projectPath The project path
 * @param type The project type
 * @param projectId The project id reference
 */
export function useCurseforgeProjectFiles(projectPath: string, type: ProjectType, projectId: Ref<number>) {
    const { downloadAndImportFile, fetchCurseForgeProjectFiles } = useService('CurseForgeService');
    const data: {
        files: Download[];
        versions: Version[];
        version: Version;
        page: number;
        pages: number;
        refreshingFile: boolean;
    } = reactive({
        files: [],
        versions: [],
        version: { type: '', text: '', value: '' } as any,
        page: 0,
        pages: 0,
        refreshingFile: false,
    });
    const dataRefs = toRefs(data);
    /**
     * Install the downloadable file to the launcher 
     * @param file The download file
     */
    function install(file: Download) {
        return downloadAndImportFile({
            id: file.id,
            name: file.name,
            href: file.href,
            projectType: type as any,
            projectPath,
            projectId: projectId.value,
        });
    }
    /**
     * Refresh files on current page.
     */
    async function refreshFiles() {
        try {
            data.refreshingFile = true;
            const { versions, files, pages } = await fetchCurseForgeProjectFiles({
                project: type,
                path: projectPath,
                version: data.version.value,
                page: data.page,
            });
            data.pages = pages;
            data.versions = versions;
            data.files = files;
        } finally {
            data.refreshingFile = false;
        }
    }
    watch([dataRefs.page, dataRefs.version], () => { refreshFiles(); });
    return {
        ...dataRefs,
        install,
        refreshFiles,
    };
}
/**
 * Hook to view the front page of the curseforge project.
 * @param id The project id
 */
export function useCurseforgeProject(projectId: number) {
    const { fetchProject } = useService('CurseForgeService');
    const { getters, state } = useStore();
    const recentFiles: Ref<File[]> = ref([]);
    const data = reactive({
        projectId: 0,
        name: '',
        image: '',
        createdDate: '',
        lastUpdate: '',
        totalDownload: 0,
        license: '',
        description: '',

        page: 1,
        pages: 1,
        version: '',

        refreshingProject: false,
    });
    const recentFilesStat = computed(() => recentFiles.value.map(file => getters.isFileInstalled(file)));
    async function refresh() {
        data.refreshingProject = true;
        try {
            const { name, , dateCreated, dateModified, downloadCount, id, latestFiles } = await fetchProject(projectId);
            data.name = name;
            data.image = image;
            data.createdDate = dateCreated;
            data.lastUpdate = dateModified;
            data.totalDownload = downloadCount;
            data.license = license.name;
            data.description = description;
            data.projectId = id;
            recentFiles.value = latestFiles;
        } finally {
            data.refreshingProject = false;
        }
    }
    function installPreview(file: Project['files'][number], index: number) {
        if (recentFilesStat.value[index]) return;
        if (state.curseforge.downloading[file.href]) return;
        downloadAndImportFile({
            id: file.id,
            name: file.name,
            href: file.href,
            projectType: type as any,
            projectPath,
            projectId: data.projectId,
        });
    }
    return {
        ...toRefs(data),
        recentFiles,
        recentFilesStat,
        refresh,
        installPreview,
    };
}

/**
 * Hook to returen the controller of curseforge preview page. Navigating the curseforge projects.
 */
export function useCurseforgePreview(type: ProjectType) {
    const { searchProjects } = useService('CurseForgeService');
    const data: {
        projects: AddonInfo[];
        page: number;
        pages: number;
        loading: boolean;
        keyword: string;
        filters: Filter[];
        versions: Version[];
    } = reactive({
        page: 0,
        pages: 0,
        projects: [],
        versions: [],
        filters: [],

        loading: false,

        keyword: '',
        searchMode: false,
    });
    const filterRef: Ref<Filter> = ref({ text: '', value: '' });
    const versionRef: Ref<Version> = ref({ text: '', value: '' });
    const refs = toRefs(data);
    async function refresh() {
        data.projects = [];
        data.loading = true;
        try {
            const projects = await searchProjects({
                pageSize: 5,
                index: data.page,
            });
            if (projects.length === 5) {
                data.pages = data.page + 5;
            }
            data.projects = Object.freeze(projects) as any;
            // data.versions = versions;
            // data.filters = filters;
            // data.pages = pages;
        } finally {
            data.loading = false;
        }
    }
    async function search() {
        if (data.loading) return;
        if (data.keyword === '') return;
        data.projects = [];
        data.loading = true;
        // data.searchMode = true;
        // try {
        //     const projects = await searchCurseforgeProjects({
        //         type,
        //         keyword: data.keyword,
        //     });

        //     data.projects = Object.freeze(projects) as any;
        // } catch (e) {
        //     data.searchMode = false;
        // } finally {
        //     data.loading = false;
        // }
    }
    watch([refs.page, filterRef, versionRef], () => refresh());
    return {
        ...refs,
        filter: filterRef,
        version: versionRef,
        search,
        refresh,
    };
}

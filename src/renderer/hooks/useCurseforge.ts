import { reactive, toRefs, ref, Ref, computed, watch, onMounted, onUnmounted } from '@vue/composition-api';
import { Project, Download, Version, ProjectType, ProjectPreview, Filter } from 'main/service/CurseForgeService';
import { useStore } from './useStore';

/**
 * Hook to view the curseforge project images.
 * @param path The project path 
 * @param type The project type
 */
export function useCurseforgeImages(path: string, type: ProjectType) {
    const { services } = useStore();
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
            const images = await services.CurseForgeService.fetchCurseforgeProjectImages({
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
    const { services } = useStore();
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
        return services.CurseForgeService.downloadAndImportFile({
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
            const { versions, files, pages } = await services.CurseForgeService.fetchCurseForgeProjectFiles({
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
 * @param projectPath The project path
 * @param type The project type
 */
export function useCurseforgeProject(projectPath: string, type: ProjectType) {
    const { services, getters, state } = useStore();
    const recentFiles: Ref<Project['files']> = ref([]);
    const data = reactive({
        projectId: 0,
        name: '',
        image: '',
        createdDate: 0,
        lastUpdate: 0,
        totalDownload: '',
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
            const { name, image, createdDate, updatedDate, totalDownload, license, description, id, files: fs } = await services.CurseForgeService.fetchCurseForgeProject({ path: projectPath, project: type as any });
            data.name = name;
            data.image = image;
            data.createdDate = createdDate;
            data.lastUpdate = updatedDate;
            data.totalDownload = totalDownload;
            data.license = license.name;
            data.description = description;
            data.projectId = id;
            recentFiles.value = fs;
        } finally {
            data.refreshingProject = false;
        }
    }
    function installPreview(file: Project['files'][number], index: number) {
        if (recentFilesStat.value[index]) return;
        if (state.curseforge.downloading[file.href]) return;
        services.CurseForgeService.downloadAndImportFile({
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
    const { services } = useStore();
    const data: {
        projects: ProjectPreview[];
        page: number;
        pages: number;
        loading: boolean;
        searchMode: boolean;
        keyword: string;
        filters: Filter[];
        versions: Version[];
    } = reactive({
        page: 1,
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
            const result = await services.CurseForgeService.fetchCurseForgeProjects({
                project: type,
                page: data.page.toString(),
                filter: filterRef.value.value,
                version: versionRef.value.value,
            });
            const { projects, versions, filters, pages } = result;

            data.projects = Object.freeze(projects) as any;
            data.versions = versions;
            data.filters = filters;
            data.pages = pages;
        } finally {
            data.loading = false;
        }
    }
    async function search() {
        if (data.loading) return;
        if (data.keyword === '') return;
        data.projects = [];
        data.loading = true;
        data.searchMode = true;
        try {
            const projects = await services.CurseForgeService.searchCurseforgeProjects({
                type,
                keyword: data.keyword,
            });

            data.projects = Object.freeze(projects) as any;
        } catch (e) {
            data.searchMode = false;
        } finally {
            data.loading = false;
        }
    }
    let handle = () => { };
    onMounted(() => {
        refresh();
        handle = watch([refs.page, filterRef, versionRef], () => refresh());
    });
    onUnmounted(() => {
        handle();
    });
    return {
        ...refs,
        filter: filterRef,
        version: versionRef,
        search,
        refresh,
    };
}

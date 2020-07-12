import { ProjectType } from '@main/service/CurseForgeService';
import { computed, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api';
import { AddonInfo, Attachment, File } from '@xmcl/curseforge';
import { useService } from './useService';
import { useStore } from './useStore';
import { useBusy } from './useSemaphore';


/**
 * Hook to view the curseforge project downloadable files.
 * @param projectId The project id
 */
export function useCurseforgeProjectFiles(projectId: number) {
    const { fetchProjectFiles } = useService('CurseForgeService');
    const { getters } = useStore();
    const data = reactive({
        files: [] as readonly File[],
        loading: false,
    });
    const status = computed(() => data.files.map(file => getters.isFileInstalled({ id: file.id, href: file.downloadUrl })));
    async function refresh() {
        data.loading = true;
        try {
            let f = await fetchProjectFiles(projectId);
            data.files = Object.freeze(f);
        } finally {
            data.loading = false;
        }
    }
    onMounted(() => {
        refresh();
    });
    return {
        ...toRefs(data),
        status,
        refresh,
    };
}

export function useCurseforgeInstall(type: ProjectType, projectId: number) {
    const { installFile } = useService('CurseForgeService');
    const { state, getters } = useStore();
    function getFileStatus(file: File): 'downloading' | 'downloaded' | 'remote' {
        let res = getters.queryResource(file.downloadUrl);
        if (res.type !== 'unknown') {
            return 'downloaded';
        }
        let downloading = state.curseforge.downloading.find((f) => f.fileId === file.id);
        return downloading ? 'downloading' : 'remote';
    }
    function getFileResource(file: File) {
        return getters.queryResource(file.downloadUrl);
    }
    async function install(file: File) {
        return installFile({ file, type, projectId });
    }

    return { getFileStatus, install, getFileResource };
}

export function useCurseforgeProjectDescription(projectId: number) {
    const { fetchProjectDescription } = useService('CurseForgeService');
    const data = reactive({
        description: '',
        loading: false,
    });
    async function refresh() {
        data.loading = true;
        try {
            let des = await fetchProjectDescription(projectId);
            data.description = des;
        } finally {
            data.loading = false;
        }
    }
    onMounted(() => {
        refresh();
    });
    return { ...toRefs(data), refresh };
}
/**
 * Hook to view the front page of the curseforge project.
 * @param id The project id
 */
export function useCurseforgeProject(projectId: number) {
    const { fetchProject } = useService('CurseForgeService');
    const recentFiles: Ref<File[]> = ref([]);
    const data = reactive({
        name: '',
        createdDate: '',
        lastUpdate: '',
        totalDownload: 0,
        attachments: [] as Attachment[],
        refreshingProject: false,
    });
    async function refresh() {
        data.refreshingProject = true;
        try {
            const proj = await fetchProject(projectId);
            const { name, dateCreated, dateModified, downloadCount, latestFiles } = proj;
            data.name = name;
            data.createdDate = dateCreated;
            data.lastUpdate = dateModified;
            data.totalDownload = downloadCount;
            data.attachments = proj.attachments;
            recentFiles.value = latestFiles;
        } finally {
            data.refreshingProject = false;
        }
    }
    onMounted(() => refresh());
    return {
        ...toRefs(data),
        recentFiles,
        refresh,
    };
}

export function useCurseforgeCategories() {
    const { loadCategories } = useService('CurseForgeService');
    const { state } = useStore();
    const categories = computed(() => state.curseforge.categories);
    const refreshing = useBusy('loadCategories');
    onMounted(() => {
        loadCategories();
    });
    return { categories, refreshing };
}

/**
 * Hook to returen the controller of curseforge preview page. Navigating the curseforge projects.
 */
export function useCurseforgeSearch(sectionId: number) {
    const { searchProjects } = useService('CurseForgeService');
    const pageSize = 5;
    const data = reactive({
        page: 1,
        pages: 5,

        gameVersion: undefined as undefined | string,

        sort: undefined as undefined | number,

        projects: [] as AddonInfo[],

        loading: false,

        keyword: undefined as undefined | string,
    });
    const index = computed(() => (data.page - 1) * pageSize);
    const searchFilter = ref(undefined as undefined | string);
    const refs = toRefs(data);
    async function refresh() {
        data.loading = true;
        try {
            const projects = await searchProjects({
                pageSize,
                index: index.value,
                sectionId,
                sort: data.sort,
                gameVersion: data.gameVersion,
                searchFilter: searchFilter.value,
            });
            if (data.page > data.pages / 2) {
                data.pages += 5;
            }
            projects.forEach(p => Object.freeze(p));
            projects.forEach(p => Object.freeze(p.categories));
            data.projects = Object.freeze(projects) as any;
        } finally {
            data.loading = false;
        }
    }
    async function search() {
        if (data.loading) return;
        if (data.keyword === '') {
            searchFilter.value = undefined;
        } else {
            searchFilter.value = data.keyword;
        }
    }
    watch([index, refs.sort, refs.gameVersion, searchFilter], () => refresh());
    onMounted(() => {
        refresh();
    });
    return {
        ...refs,
        search,
        refresh,
    };
}

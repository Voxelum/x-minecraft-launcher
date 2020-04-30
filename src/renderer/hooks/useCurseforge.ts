import { Filter, Project, ProjectType, Version } from '@main/service/CurseForgeService';
import { computed, onMounted, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api';
import { AddonInfo, File, Attachment, Category } from '@xmcl/curseforge';
import { useService } from './useService';
import { useStore } from './useStore';


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

export function useCurseforgeInstall() {
    function getFileStatus(file: File): 'downloading' | 'downloaded' | 'remote' {
        return 'remote';
    }
    async function install(file: File) {
        // const promise = projectFiles.install(download);
        // if (props.type === 'modpacks') {
        //   subscribe(promise, () => 'Download Success! Please create the instance by this modpack in instances panel', () => 'Fail to download this modpack!');
        // }
        // return promise;
    }

    return { getFileStatus, install };
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
    const { state, getters } = useStore();
    const categories = computed(() => state.curseforge.categories);
    const refreshing = computed(() => getters.busy('loadCategories'));
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
        page: 0,
        pages: 5,

        gameVersion: undefined as undefined | string,

        sort: undefined as undefined | number,

        projects: [] as AddonInfo[],

        loading: false,

        keyword: undefined as undefined | string,
    });
    const index = computed(() => data.page * pageSize);
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
    return {
        ...refs,
        search,
        refresh,
    };
}

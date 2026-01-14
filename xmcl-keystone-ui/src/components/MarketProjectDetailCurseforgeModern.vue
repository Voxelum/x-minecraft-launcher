<script setup lang="ts">
import {
  CategoryItem,
  ExternalResource,
  Info,
  ModGallery,
  ProjectDependency,
  ProjectDetail,
} from "@/components/MarketProjectDetail.vue";
import { ProjectVersion } from "@/components/MarketProjectDetailVersion.vue";
import {
  getCurseforgeProjectDescriptionModel,
  getCurseforgeProjectModel,
  useCurseforgeCategoryI18n,
  useCurseforgeProjectFiles,
} from "@/composables/curseforge";
import { useCurseforgeChangelog } from "@/composables/curseforgeChangelog";
import {
  getCurseforgeDependenciesModel,
  useCurseforgeTask,
} from "@/composables/curseforgeDependencies";
import { kCurseforgeInstaller } from "@/composables/curseforgeInstaller";
import { useDateString } from "@/composables/date";
import { useI18nSearchFlights } from "@/composables/flights";
import { useAutoI18nCommunityContent } from "@/composables/i18n";
import {
  useInCollection,
  useModrinthFollow,
} from "@/composables/modrinthAuthenticatedAPI";
import {
  useProjectDetailEnable,
  useProjectDetailUpdate,
} from "@/composables/projectDetail";
import { useNotifier } from "@/composables/notifier";
import { useService } from "@/composables/service";
import { useLoading, useSWRVModel } from "@/composables/swrv";
import { basename } from "@/util/basename";
import {
  getCurseforgeFileGameVersions,
  getCurseforgeRelationType,
  getCursforgeFileModLoaders,
  getCursforgeModLoadersFromString,
  getModLoaderTypesForFile,
} from "@/util/curseforge";
import { injection } from "@/util/inject";
import { ModFile, getModMinecraftVersion, isModFile } from "@/util/mod";
import { ProjectFile } from "@/util/search";
import { FileModLoaderType, Mod, ModStatus } from "@xmcl/curseforge";
import { ProjectMapping, ProjectMappingServiceKey } from "@xmcl/runtime-api";

const props = defineProps<{
  curseforge?: Mod;
  curseforgeId: number;
  installed: ProjectFile[];
  gameVersion: string;
  loader?: string;
  allFiles: ProjectFile[];
  category?: number;
  updating?: boolean;
  modrinth?: string;
}>();

const emit = defineEmits<{
  (event: "category", cat: number): void;
  (event: "uninstall", files: ProjectFile[]): void;
  (event: "enable", file: ProjectFile): void;
  (event: "disable", file: ProjectFile): void;
}>();

const { getDateString } = useDateString();

const curseforgeModId = computed(() => props.curseforgeId);

const { data: curseforgeProject, mutate } = useSWRVModel(
  getCurseforgeProjectModel(curseforgeModId)
);
const { lookupByCurseforge } = useService(ProjectMappingServiceKey);

const curseforgeProjectMapping = shallowRef(
  undefined as ProjectMapping | undefined
);

watch(
  curseforgeModId,
  async (id) => {
    const result = await lookupByCurseforge(id).catch(() => undefined);
    if (id === curseforgeModId.value) {
      curseforgeProjectMapping.value = result;
    }
  },
  { immediate: true }
);

const { data: description, isValidating: isValidatingDescription } =
  useSWRVModel(getCurseforgeProjectDescriptionModel(curseforgeModId));

const i18nSearch = useI18nSearchFlights();

const localizedBody = ref("");

if (i18nSearch) {
  const { getContent } = useAutoI18nCommunityContent(i18nSearch);
  watch(
    curseforgeModId,
    async (id) => {
      localizedBody.value = "";
      const result = await getContent("curseforge", id);
      if (id === curseforgeModId.value) {
        localizedBody.value = result;
      }
    },
    { immediate: true }
  );
}

const model = computed(() => {
  const externals: ExternalResource[] = [];
  const mod = props.curseforge || curseforgeProject.value;

  if (mod?.links.issuesUrl) {
    externals.push({
      icon: "pest_control",
      name: t("modrinth.issueUrl"),
      url: mod.links.issuesUrl,
    });
  }
  if (mod?.links.websiteUrl) {
    externals.push({
      icon: "web",
      name: "Website",
      url: mod.links.websiteUrl,
    });
  }
  if (mod?.links.sourceUrl) {
    externals.push({
      icon: "code",
      name: t("modrinth.sourceUrl"),
      url: mod.links.sourceUrl,
    });
  }
  if (mod?.links.wikiUrl) {
    externals.push({
      icon: "public",
      name: t("modrinth.wikiUrl"),
      url: mod.links.wikiUrl,
    });
  }
  const categories: CategoryItem[] =
    mod?.categories.map((c) =>
      reactive({
        id: c.id.toString(),
        name: computed(() => tCategory(c.name)),
        iconUrl: c.iconUrl,
      })
    ) || [];
  const info: Info[] = [];
  if (mod?.dateCreated) {
    info.push({
      name: t("curseforge.createdDate"),
      icon: "event_available",
      value: getDateString(mod.dateCreated),
    });
  }
  if (mod?.dateModified) {
    info.push({
      name: t("curseforge.lastUpdate"),
      icon: "edit_calendar",
      value: getDateString(mod.dateModified),
    });
  }
  if (mod?.dateReleased) {
    info.push({
      name: t("curseforge.releasedDate"),
      icon: "calendar_month",
      value: getDateString(mod.dateReleased),
    });
  }
  if (mod?.slug) {
    info.push({
      name: "Slug",
      icon: "link",
      value: mod.slug,
    });
  }
  const galleries: ModGallery[] = [];
  if (mod?.screenshots) {
    for (const image of mod.screenshots) {
      galleries.push({
        title: image.title,
        description: image.description,
        rawUrl: image.url,
        url: image?.thumbnailUrl ?? "",
      });
    }
  }
  const mapping = {
    [FileModLoaderType.Forge]: "forge",
    [FileModLoaderType.Fabric]: "fabric",
    [FileModLoaderType.Quilt]: "quilt",
    [FileModLoaderType.NeoForge]: "neoforge",
  } as Record<FileModLoaderType, string>;
  const modLoaders = [
    ...new Set(mod?.latestFilesIndexes.map((v) => mapping[v.modLoader]) || []),
  ];
  const detail: ProjectDetail = {
    id: props.curseforgeId.toString(),
    title: mod?.name ?? "",
    icon: mod?.logo.url ?? "",
    description: mod?.summary ?? "",
    author: mod?.authors.map((a) => a.name).join(", ") ?? "",
    downloadCount: mod?.downloadCount ?? 0,
    follows: mod?.thumbsUpCount ?? 0,
    url: mod?.links.websiteUrl ?? "",
    categories,
    htmlContent: description.value ?? "",
    modLoaders,
    externals,
    galleries,
    info,
    archived:
      ModStatus.Inactive === mod?.status || ModStatus.Abandoned === mod?.status,
  };

  if (
    curseforgeProjectMapping.value &&
    curseforgeProjectMapping.value.curseforgeId === curseforgeModId.value
  ) {
    const mapped = curseforgeProjectMapping.value;
    detail.localizedTitle = mapped.name;
    detail.localizedDescription = mapped.description;
  }

  if (localizedBody.value) {
    detail.localizedHtmlContent = localizedBody.value;
  }

  return detail;
});

const loading = useLoading(
  isValidatingDescription,
  description,
  curseforgeModId
);

const { t } = useI18n();
const tCategory = useCurseforgeCategoryI18n();
const releaseTypes: Record<string, "release" | "beta" | "alpha"> = {
  1: "release",
  2: "beta",
  3: "alpha",
};

const {
  files,
  refreshing: loadingVersions,
  index,
  totalCount,
  pageSize,
} = useCurseforgeProjectFiles(
  curseforgeModId,
  computed(() => props.gameVersion),
  computed(() => getCursforgeModLoadersFromString(props.loader)[0])
);

const modId = ref(0);
const fileId = ref(undefined as number | undefined);
const { changelog, isValidating } = useCurseforgeChangelog(modId, fileId);

const modVersions = computed(() => {
  const versions: ProjectVersion[] = [];
  const installed = [...props.installed];
  for (const file of files.value) {
    const installedFileIndex = installed.findIndex(
      (f) => f.curseforge?.fileId === file.id
    );
    const f =
      installedFileIndex === -1
        ? undefined
        : installed.splice(installedFileIndex, 1);

    versions.push(
      reactive({
        id: file.id.toString(),
        name: file.displayName,
        version: file.fileName,
        disabled: false,
        changelog: computed(() =>
          file.id === fileId.value ? changelog.value : undefined
        ),
        changelogLoading: isValidating,
        type: releaseTypes[file.releaseType],
        installed: !!f,
        downloadCount: file.downloadCount,
        loaders: getCursforgeFileModLoaders(file),
        minecraftVersion: getCurseforgeFileGameVersions(file).join(", "),
        createdDate: file.fileDate,
      })
    );
  }

  for (const i of installed) {
    const minecraftVersion = isModFile(i)
      ? getModMinecraftVersion(i)
      : undefined;
    versions.push({
      id: i.curseforge?.fileId.toString() ?? "",
      name: basename(i.path) ?? "",
      version: i.version,
      disabled: false,
      changelog: undefined,
      changelogLoading: false,
      type: "release",
      installed: true,
      downloadCount: 0,
      loaders: "modLoaders" in i ? (i as ModFile).modLoaders : [],
      minecraftVersion,
      createdDate: "",
    });
  }

  return versions;
});

const loadChangelog = (version: ProjectVersion) => {
  modId.value = props.curseforgeId;
  fileId.value = Number(version.id);
};

const onLoadMore = () => {
  index.value += pageSize.value;
};

const selectedVersion = ref(
  modVersions.value.find((v) => v.installed) ??
    (modVersions.value[0] as ProjectVersion | undefined)
);
provide("selectedVersion", selectedVersion);

const innerUpdating = useProjectDetailUpdate();

watch(
  () => props.curseforge,
  () => {
    innerUpdating.value = false;
  }
);
watch(
  () => props.installed,
  () => {
    innerUpdating.value = false;
  },
  { deep: true }
);

const {
  enabled,
  installed: isInstalled,
  hasInstalledVersion,
} = useProjectDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  innerUpdating,
  (f) => emit("enable", f),
  (f) => emit("disable", f)
);

const curseforgeFile = computed(() =>
  files.value.find((f) => f.id === Number(selectedVersion.value?.id))
);
const {
  data: deps,
  error,
  isValidating: loadingDependencies,
} = useSWRVModel(
  getCurseforgeDependenciesModel(
    curseforgeFile,
    computed(() => props.gameVersion),
    // TODO: limit the modloaders
    computed(() =>
      curseforgeFile.value
        ? getModLoaderTypesForFile(curseforgeFile.value).values().next().value!
        : FileModLoaderType.Any
    )
  )
);

const dependencies = computed(() =>
  !curseforgeFile.value
    ? []
    : deps.value?.map((resolvedDep) => {
        const task = useCurseforgeTask(computed(() => resolvedDep.file.id));
        const file = computed(() => {
          for (const file of props.allFiles) {
            if (file.curseforge?.fileId === resolvedDep.file.id) {
              return file;
            }
          }
          return undefined;
        });
        const otherFile = computed(() => {
          for (const file of props.allFiles) {
            if (
              file.curseforge?.projectId === resolvedDep.project.id &&
              file.curseforge?.fileId !== resolvedDep.file.id
            ) {
              return file;
            }
          }
          return undefined;
        });
        const dep: ProjectDependency = reactive({
          id: resolvedDep.project.id.toString(),
          icon: resolvedDep.project.logo?.url,
          title: resolvedDep.project.name,
          version: resolvedDep.file.displayName,
          description: resolvedDep.file.fileName,
          type: getCurseforgeRelationType(resolvedDep.type),
          parent: resolvedDep.parent?.name ?? "",
          installedVersion: computed(() => file.value?.version),
          installedDifferentVersion: computed(() => otherFile.value?.version),
          progress: computed(() =>
            task.value ? task.value.progress / task.value.total : -1
          ),
        });
        return dep;
      }) ?? []
);

const installing = ref(false);

const { install, installWithDependencies } = injection(kCurseforgeInstaller);

const { notify } = useNotifier();

const onInstall = async (mod: ProjectVersion) => {
  try {
    installing.value = true;
    await installWithDependencies(
      Number(mod.id),
      mod.loaders,
      curseforgeProject.value?.logo.url,
      props.installed,
      deps.value ?? []
    );
    notify({ title: t("modInstall.installed"), level: "success" });
  } finally {
    installing.value = false;
  }
};

watch(modVersions, (versions) => {
  if (!selectedVersion.value && versions.length > 0) {
    selectedVersion.value = versions.find((v) => v.installed) ?? versions[0];
  }
});
const installDependency = async (dep: ProjectDependency) => {
  const d = deps.value?.find((d) => d.project.id.toString() === dep.id);
  if (!d) return;
  const ver = d.file;
  try {
    installing.value = true;
    const resources = [] as ProjectFile[];
    if (dep.installedDifferentVersion) {
      for (const file of props.allFiles) {
        if (file.curseforge?.fileId === d.project.id) {
          resources.push(file);
        }
      }
    }
    await install({ fileId: ver.id, icon: dep.icon });
    if (resources.length > 0) {
      emit("uninstall", resources);
    }
  } finally {
    installing.value = false;
  }
};

const onDelete = () => {
  innerUpdating.value = true;
  emit("uninstall", props.installed);
};

const { push, currentRoute } = useRouter();
const onOpenDependency = (dep: ProjectDependency) => {
  push({ query: { ...currentRoute.query, id: `curseforge:${dep.id}` } });
};

const onRefresh = () => {
  mutate();
};

const modrinthId = computed(
  () =>
    props.modrinth ||
    props.allFiles.find(
      (v) => v.curseforge?.projectId === props.curseforgeId && v.modrinth
    )?.modrinth?.projectId ||
    curseforgeProjectMapping.value?.modrinthId
);
const { isFollowed, following, onFollow } = useModrinthFollow(modrinthId);

// Modern specific logic
const tab = ref(0);
const items = computed(() => [
  t("mod.description"),
  "Gallery",
  t("mod.versions"),
]);

const getIcon = (link: { name: string; url: string; icon: string }) => {
  const url = link.url.toLowerCase();
  const name = link.name.toLowerCase();
  if (url.includes("discord") || name.includes("discord"))
    return "$vuetify.icons.discord";
  if (url.includes("github") || name.includes("github"))
    return "$vuetify.icons.github";
  if (url.includes("reddit") || name.includes("reddit"))
    return "$vuetify.icons.reddit";
  if (url.includes("youtube") || name.includes("youtube"))
    return "$vuetify.icons.youtube";
  if (name.includes("source")) return "code";
  if (name.includes("issue")) return "bug_report";
  if (name.includes("wiki")) return "menu_book";
  return link.icon || "open_in_new";
};

// Compute reason why install is disabled
const installDisabledReason = computed(() => {
  if (!selectedVersion.value) {
    if (loadingVersions.value) {
      return t("modInstall.loadingVersions");
    }
    if (modVersions.value.length === 0) {
      return t("modInstall.noVersionsAvailable");
    }
    return t("modInstall.selectVersion");
  }
  return "";
});

const isInstallDisabled = computed(() => !selectedVersion.value);
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden bg-transparent">
    <div class="flex flex-col h-full relative overflow-y-auto custom-scrollbar">
      <!-- Background Header -->
      <div
        class="absolute inset-x-0 top-0 h-[400px] overflow-hidden pointer-events-none z-0"
      >
        <v-img
          v-if="model.icon"
          :src="model.icon"
          class="w-full h-full object-cover blur-[60px] opacity-20 scale-125 transform translate-y-[-10%]"
        >
          <div
            class="fill-height bg-gradient-to-b from-[#121212]/30 via-[#121212]/80 to-[#121212]"
          ></div>
        </v-img>
      </div>

      <!-- Content Container -->
      <div class="relative z-10 flex flex-col flex-1 max-w-7xl mx-auto w-full">
        <!-- Hero Section -->
        <div class="px-8 pt-10 pb-6 flex gap-6 items-start shrink-0">
          <!-- Icon -->
          <v-img
            :src="model.icon"
            max-width="140"
            max-height="140"
            class="rounded-xl shadow-2xl shrink-0 bg-[#212121] ring-1 ring-white/10"
            contain
          ></v-img>

          <div class="flex flex-col flex-1 min-w-0 gap-3 pt-1">
            <!-- Title & Author -->
            <div>
              <h1
                class="text-4xl font-extrabold text-white tracking-tight drop-shadow-sm mb-1 line-clamp-1"
                :title="model.title"
              >
                {{ model.title }}
              </h1>
              <div class="flex items-center gap-2 text-gray-400 text-sm">
                <span
                  class="font-medium hover:text-white transition-colors cursor-pointer"
                >
                  {{ model.author }}
                </span>
                <span>•</span>
                <span
                  >{{ (model.downloadCount / 1000).toFixed(1) }}k
                  Downloads</span
                >
                <span>•</span>
                <span
                  class="flex items-center gap-1 active:text-red-400 cursor-pointer transition-colors"
                  @click="onFollow"
                >
                  <v-icon
                    x-small
                    :color="isFollowed ? 'red' : 'gray'"
                    class="mr-0.5"
                    >{{ isFollowed ? "favorite" : "favorite_border" }}</v-icon
                  >
                  {{ model.follows }} Likes
                </span>
              </div>
            </div>

            <!-- Description -->
            <p
              class="text-gray-300 text-base leading-relaxed line-clamp-2 max-w-4xl"
            >
              {{ model.description }}
            </p>

            <!-- Categories -->
            <div class="flex flex-wrap gap-2 mt-1">
              <v-chip
                v-for="cat in model.categories"
                :key="cat.id"
                x-small
                label
                class="bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors cursor-pointer font-medium uppercase tracking-wide"
                @click="emit('category', Number(cat.id))"
              >
                <v-avatar left v-if="cat.iconUrl" class="mr-1">
                  <v-img :src="cat.iconUrl"></v-img>
                </v-avatar>
                {{ cat.name }}
              </v-chip>
            </div>
          </div>

          <div
            class="flex flex-col gap-1 self-start actions-group min-w-[200px] shrink-0"
          >
            <v-btn
              block
              large
              color="#f57c00"
              class="shadow-lg shadow-orange-900/20 font-bold tracking-wide rounded-lg"
              :loading="installing || innerUpdating"
              :disabled="isInstallDisabled"
              style="text-transform: none; font-size: 1.1rem; height: 48px"
              @click="selectedVersion && onInstall(selectedVersion)"
            >
              <v-icon left>download</v-icon>
              {{
                props.installed.length > 0
                  ? t("modInstall.reinstall")
                  : t("modInstall.install")
              }}
            </v-btn>
            <span
              v-if="installDisabledReason"
              class="text-xs text-amber-400/80 text-center px-2"
            >
              <v-icon x-small class="mr-1" color="amber">info</v-icon>
              {{ installDisabledReason }}
            </span>
          </div>
        </div>

        <!-- Navigation -->
        <div
          class="px-8 sticky top-0 bg-[#121212]/95 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between shrink-0 mb-6"
        >
          <v-tabs
            v-model="tab"
            background-color="transparent"
            slider-color="#f57c00"
            height="48"
            class="font-bold"
          >
            <v-tab
              v-for="item in items"
              :key="item"
              class="tracking-wide text-sm opacity-70 data-[active=true]:opacity-100 data-[active=true]:text-[#f57c00]"
              >{{ item }}</v-tab
            >
          </v-tabs>
        </div>

        <!-- Main Content Grid -->
        <div class="px-8 pb-10 grid grid-cols-12 gap-8 items-start">
          <!-- Left Column (Content) -->
          <div class="col-span-8 min-w-0">
            <!-- Description -->
            <div
              v-show="tab === 0"
              class="prose prose-invert prose-orange max-w-none prose-img:rounded-xl prose-headings:font-bold prose-a:no-underline hover:prose-a:underline bg-[#212121]/30 p-6 rounded-2xl border border-white/5 shadow-inner"
            >
              <div v-html="model.htmlContent" class="select-text"></div>
            </div>

            <!-- Gallery -->
            <div v-show="tab === 1" class="grid grid-cols-2 gap-4">
              <v-img
                v-for="img in model.galleries"
                :key="img.url"
                :src="img.url"
                aspect-ratio="1.7778"
                class="rounded-xl cursor-pointer hover:ring-2 ring-[#f57c00] transition-all shadow-lg bg-[#212121]"
              ></v-img>
            </div>

            <!-- Versions -->
            <div v-show="tab === 2" class="space-y-3">
              <div
                v-if="loadingVersions"
                class="flex items-center justify-center py-10"
              >
                <v-progress-circular
                  indeterminate
                  color="warning"
                  size="32"
                ></v-progress-circular>
              </div>
              <div
                v-else-if="modVersions.length === 0"
                class="text-center text-gray-500 py-10 bg-[#212121]/30 rounded-2xl border border-white/5"
              >
                <v-icon size="48" class="mb-2 opacity-50">list</v-icon>
                <p>{{ t("modInstall.noVersionsAvailable") }}</p>
              </div>
              <div
                v-else
                v-for="ver in modVersions"
                :key="ver.id"
                class="bg-[#212121]/50 rounded-xl border border-white/5 hover:border-[#f57c00]/30 transition-all p-4 cursor-pointer"
                :class="{
                  'ring-2 ring-[#f57c00] bg-[#f57c00]/10': ver.installed,
                }"
                @click="selectedVersion = ver"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-white">{{ ver.name }}</span>
                      <v-chip
                        x-small
                        :color="
                          ver.type === 'release'
                            ? 'success'
                            : ver.type === 'beta'
                            ? 'warning'
                            : 'info'
                        "
                        class="font-medium uppercase text-xs"
                      >
                        {{ ver.type }}
                      </v-chip>
                      <v-chip
                        v-if="ver.installed"
                        x-small
                        color="warning"
                        class="font-medium"
                      >
                        <v-icon x-small left>check_circle</v-icon>
                        {{ t("modInstall.installed") }}
                      </v-chip>
                    </div>
                    <div
                      class="text-xs text-gray-400 mt-1 flex items-center gap-3"
                    >
                      <span
                        v-if="ver.minecraftVersion"
                        class="flex items-center gap-1"
                      >
                        <v-icon x-small>sports_esports</v-icon>
                        {{ ver.minecraftVersion }}
                      </span>
                      <span
                        v-if="ver.loaders?.length"
                        class="flex items-center gap-1"
                      >
                        <v-icon x-small>settings</v-icon>
                        {{ ver.loaders.join(", ") }}
                      </span>
                      <span
                        v-if="ver.downloadCount"
                        class="flex items-center gap-1"
                      >
                        <v-icon x-small>file_download</v-icon>
                        {{ (ver.downloadCount / 1000).toFixed(1) }}k
                      </span>
                    </div>
                  </div>
                  <v-btn
                    small
                    :color="ver.installed ? 'grey' : 'warning'"
                    :disabled="installing || ver.installed"
                    :loading="installing && selectedVersion?.id === ver.id"
                    @click.stop="onInstall(ver)"
                  >
                    <v-icon left small>{{
                      ver.installed ? "check" : "download"
                    }}</v-icon>
                    {{
                      ver.installed
                        ? t("modInstall.installed")
                        : t("modInstall.install")
                    }}
                  </v-btn>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column (Sidebar) -->
          <div class="col-span-4 flex flex-col gap-6 sticky top-20">
            <!-- Information Card -->
            <div
              class="bg-[#212121]/50 backdrop-blur-sm rounded-xl border border-white/5 overflow-hidden shadow-lg"
            >
              <div
                class="px-4 py-3 border-b border-white/5 bg-white/5 font-bold text-sm tracking-wide text-gray-200"
              >
                Information
              </div>
              <div class="p-4 flex flex-col gap-4 text-sm">
                <div class="flex justify-between items-center group">
                  <span class="text-gray-400">Project ID</span>
                  <span
                    class="font-mono text-gray-300 bg-black/20 px-2 py-0.5 rounded select-all group-hover:bg-black/40 transition-colors"
                    >{{ props.curseforgeId }}</span
                  >
                </div>
                <div
                  class="flex justify-between items-center"
                  v-for="i in model.info"
                  :key="i.name"
                >
                  <span class="text-gray-400">{{ i.name }}</span>
                  <span class="text-gray-300 text-right">{{ i.value }}</span>
                </div>
              </div>
            </div>

            <!-- Links Card -->
            <div
              class="bg-[#212121]/50 backdrop-blur-sm rounded-xl border border-white/5 overflow-hidden shadow-lg"
            >
              <div
                class="px-4 py-3 border-b border-white/5 bg-white/5 font-bold text-sm tracking-wide text-gray-200"
              >
                Links
              </div>
              <div class="p-2 grid grid-cols-2 gap-2">
                <a
                  v-for="link in model.externals"
                  :key="link.name"
                  :href="link.url"
                  target="_blank"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all group no-underline text-gray-300 bg-white/5"
                >
                  <v-icon
                    small
                    class="text-gray-400 group-hover:text-white transition-colors"
                    >{{ getIcon(link) }}</v-icon
                  >
                  <span
                    class="font-medium text-xs truncate group-hover:text-white transition-colors"
                    >{{ link.name }}</span
                  >
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

:deep(.prose) {
  color: #e0e0e0;
}
:deep(.prose h1),
:deep(.prose h2),
:deep(.prose h3),
:deep(.prose h4) {
  color: #ffffff;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
:deep(.prose a) {
  color: #f57c00;
}
:deep(.prose blockquote) {
  border-left-color: #f57c00;
  background: rgba(245, 124, 0, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
}
</style>

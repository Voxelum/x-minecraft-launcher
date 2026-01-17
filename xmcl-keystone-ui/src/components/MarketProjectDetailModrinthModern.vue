<script setup lang="ts">
import { ProjectDependency } from "@/components/MarketProjectDetail.vue";
import { ProjectVersion as ProjectDetailVersion } from "@/components/MarketProjectDetailVersion.vue";
import {
  useInCollection,
  useModrinthFollow,
} from "@/composables/modrinthAuthenticatedAPI";
import { getModrinthDependenciesModel } from "@/composables/modrinthDependencies";
import { kModrinthInstaller } from "@/composables/modrinthInstaller";
import { useModrinthProject } from "@/composables/modrinthProject";
import {
  useModrinthProjectDetailData,
  useModrinthProjectDetailVersions,
} from "@/composables/modrinthProjectDetailData";
import {
  getModrinthVersionModel,
  useModrinthTask,
} from "@/composables/modrinthVersions";
import {
  useProjectDetailEnable,
  useProjectDetailUpdate,
} from "@/composables/projectDetail";
import { useService } from "@/composables/service";
import { useLoading, useSWRVModel } from "@/composables/swrv";
import { kSWRVConfig } from "@/composables/swrvConfig";
import { injection } from "@/util/inject";
import { ProjectFile } from "@/util/search";
import { kImageDialog } from "@/composables/imageDialog";
import { SearchResultHit } from "@xmcl/modrinth";
import { ProjectMapping, ProjectMappingServiceKey } from "@xmcl/runtime-api";
import Hint from "./Hint.vue";
import { CategoryItem } from "@/components/MarketProjectDetail.vue";

const props = defineProps<{
  modrinth?: SearchResultHit;
  projectId: string;
  installed: ProjectFile[];
  loader?: string;
  categories: string[];
  gameVersion: string;
  allFiles: ProjectFile[];
  updating?: boolean;
  curseforge?: number;
}>();

const emit = defineEmits<{
  (event: "category", cat: string): void;
  (event: "uninstall", files: ProjectFile[]): void;
  (event: "enable", file: ProjectFile): void;
  (event: "disable", file: ProjectFile): void;
}>();

// Project
const projectId = computed(() => props.projectId);
const {
  project,
  isValidating: isValidatingModrinth,
  refresh,
  error,
} = useModrinthProject(projectId);
const { lookupByModrinth } = useService(ProjectMappingServiceKey);

const mapping = shallowRef(undefined as ProjectMapping | undefined);

watch(
  projectId,
  async (id) => {
    const result = await lookupByModrinth(id).catch(() => undefined);
    if (id === projectId.value) {
      mapping.value = result;
    }
  },
  { immediate: true }
);

const model = useModrinthProjectDetailData(
  projectId,
  project,
  computed(() => props.modrinth),
  mapping
);
const loading = useLoading(isValidatingModrinth, project, projectId);
const modLoader = computed(() => props.loader);

// Versions
const { data: versions, isValidating: loadingVersions } = useSWRVModel(
  getModrinthVersionModel(
    projectId,
    undefined,
    modLoader,
    computed(() => (props.gameVersion ? [props.gameVersion] : undefined))
  ),
  inject(kSWRVConfig)
);
const modVersions = useModrinthProjectDetailVersions(
  versions,
  computed(() => props.installed)
);

const selectedVersion = ref(
  modVersions.value.find((v) => v.installed) ??
    (modVersions.value[0] as ProjectDetailVersion | undefined)
);
provide("selectedVersion", selectedVersion);

const supportedVersions = computed(() => {
  if (!project.value) return [];
  return project.value.game_versions;
});

// Dependencies
const version = computed(() =>
  versions.value?.find((v) => v.id === selectedVersion.value?.id)
);
const { data: deps, isValidating } = useSWRVModel(
  getModrinthDependenciesModel(version, modLoader),
  { revalidateOnFocus: false }
);
const dependencies = computed(() => {
  if (!version.value) return [];
  if (!deps.value) return [];

  return (
    deps.value.map(
      ({ recommendedVersion, versions, project, type, parent }) => {
        // TODO: optimize this perf
        const file = computed(() => {
          for (const file of props.allFiles) {
            if (file.modrinth?.versionId === recommendedVersion.id) {
              return file;
            }
          }
          return undefined;
        });
        const otherFile = computed(() => {
          for (const file of props.allFiles) {
            if (
              file.modrinth?.projectId === project.id &&
              file.modrinth?.versionId !== recommendedVersion.id
            ) {
              return file;
            }
          }
          return undefined;
        });
        const { progress, total, task } = useModrinthTask(computed(() => recommendedVersion.id));
        const dep: ProjectDependency = reactive({
          id: project.id,
          icon: project.icon_url,
          title: project.title,
          version: recommendedVersion.name,
          description: recommendedVersion.files[0].filename,
          type,
          parent: parent?.title ?? "",
          installedVersion: computed(() => file.value?.version),
          installedDifferentVersion: computed(() => otherFile.value?.version),
          progress: computed(() =>
            task.value ? progress.value / total.value : -1
          ),
        });
        return dep;
      }
    ) ?? []
  );
});

const innerUpdating = useProjectDetailUpdate();
watch(
  () => props.modrinth,
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

import { useNotifier } from "@/composables/notifier";

const { notify } = useNotifier();

// Install
const installing = ref(false);
const { install, installWithDependencies } = injection(kModrinthInstaller);
const onInstall = async (v: ProjectDetailVersion) => {
  try {
    installing.value = true;
    await installWithDependencies(
      v.id,
      v.loaders,
      project.value?.icon_url,
      props.installed,
      deps.value ?? []
    );
    notify({ title: t("shared.installed"), level: "success" });
  } finally {
    installing.value = false;
  }
};

watch(modVersions, (versions) => {
  if (!selectedVersion.value && versions.length > 0) {
    selectedVersion.value = versions.find((v) => v.installed) ?? versions[0];
  }
});
const onInstallDependency = async (dep: ProjectDependency) => {
  const resolvedDep = deps.value?.find((d) => d.project.id === dep.id);
  if (!resolvedDep) return;
  const version = resolvedDep.recommendedVersion;
  try {
    installing.value = true;
    const files = [] as ProjectFile[];
    if (dep.installedDifferentVersion) {
      for (const file of props.allFiles) {
        if (file.modrinth?.projectId === resolvedDep.project.id) {
          files.push(file);
        }
      }
    }
    await install({
      versionId: version.id,
      icon: resolvedDep.project.icon_url,
    });
    if (files.length > 0) {
      emit("uninstall", files);
    }
  } finally {
    installing.value = false;
  }
};

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

const onDelete = () => {
  innerUpdating.value = true;
  emit("uninstall", props.installed);
};

const { push, currentRoute } = useRouter();
const onOpenDependency = (dep: ProjectDependency) => {
  push({ query: { ...currentRoute.query, id: `modrinth:${dep.id}` } });
};

const curseforgeId = computed(
  () =>
    props.curseforge ||
    props.allFiles.find(
      (v) => v.modrinth?.projectId === props.projectId && v.curseforge
    )?.curseforge?.projectId ||
    mapping.value?.curseforgeId
);

const isNotFound = computed(() => error.value?.status === 404);
const { replace } = useRouter();
const goCurseforgeProject = (id: number) => {
  replace({ query: { ...currentRoute.query, id: `curseforge:${id}` } });
};

const { isFollowed, following, onFollow } = useModrinthFollow(projectId);
const { collectionId, onAddOrRemove, loadingCollections } =
  useInCollection(projectId);

const { t } = useI18n();

// Image dialog for gallery
const imageDialog = injection(kImageDialog);

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
  if (url.includes("discord") || name.includes("discord")) return "chat_bubble";
  if (url.includes("github") || name.includes("github")) return "code";
  if (url.includes("reddit") || name.includes("reddit")) return "forum";
  if (url.includes("youtube") || name.includes("youtube"))
    return "play_circle_filled";
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
    <Hint
      v-if="isNotFound"
      icon="warning"
      color="red"
      class="px-10 h-full"
      :size="100"
      :text="t('errors.NotFoundError')"
    >
      <div>
        <v-btn
          color="primary"
          text
          v-if="curseforgeId"
          @click="goCurseforgeProject(curseforgeId)"
        >
          <v-icon left>$vuetify.icons.curseforge</v-icon>
          Curseforge
        </v-btn>
      </div>
    </Hint>

    <div
      v-else
      class="flex flex-col h-full relative overflow-y-auto custom-scrollbar"
    >
      <!-- Background Header -->
      <div
        class="absolute inset-x-0 top-0 h-[400px] overflow-hidden pointer-events-none z-0"
      >
        <v-img
          v-if="project?.icon_url"
          :src="project?.icon_url"
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
            :src="project?.icon_url"
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
                  >Updated
                  {{
                    new Date(
                      project?.updated || Date.now()
                    ).toLocaleDateString()
                  }}</span
                >
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
                @click="emit('category', cat.id)"
              >
                {{ cat.name }}
              </v-chip>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-3 min-w-[200px] shrink-0">
            <div class="flex flex-col gap-1">
              <v-btn
                block
                large
                color="#4caf50"
                class="shadow-lg shadow-green-900/20 font-bold tracking-wide rounded-lg"
                :loading="installing || innerUpdating"
                :disabled="isInstallDisabled"
                style="text-transform: none; font-size: 1.1rem; height: 48px"
                @click="selectedVersion && onInstall(selectedVersion)"
              >
                <v-icon left>download</v-icon>
                {{
                  installed.length > 0
                    ? t("modInstall.reinstall")
                    : t("shared.install")
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

            <div class="flex gap-2">
              <v-btn
                flex-1
                outlined
                class="bg-[#212121]/50 border-white/10 hover:border-white/30 text-gray-300"
                @click="onFollow"
              >
                <v-icon
                  small
                  :color="isFollowed ? 'red' : 'gray'"
                  class="mr-1"
                  >{{ isFollowed ? "favorite" : "favorite_border" }}</v-icon
                >
                {{ isFollowed ? "Following" : "Follow" }}
              </v-btn>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div
          class="px-8 sticky top-0 bg-[#121212]/95 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between shrink-0 mb-6"
        >
          <v-tabs
            v-model="tab"
            background-color="transparent"
            slider-color="#4caf50"
            height="48"
            class="font-bold"
          >
            <v-tab
              v-for="item in items"
              :key="item"
              class="tracking-wide text-sm opacity-70 data-[active=true]:opacity-100 data-[active=true]:text-[#4caf50]"
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
              class="prose prose-invert prose-green max-w-none prose-img:rounded-xl prose-headings:font-bold prose-a:no-underline hover:prose-a:underline bg-[#212121]/30 p-6 rounded-2xl border border-white/5 shadow-inner"
            >
              <div v-html="model.htmlContent" class="select-text"></div>
            </div>

            <!-- Gallery -->
            <div v-show="tab === 1" class="grid grid-cols-2 gap-4">
              <v-img
                v-for="(img, idx) in model.galleries"
                :key="img.url"
                :src="img.url"
                aspect-ratio="1.7778"
                class="rounded-xl cursor-pointer hover:ring-2 ring-[#4caf50] transition-all shadow-lg bg-[#212121]"
                @click="imageDialog.showAll(model.galleries.map(g => ({ src: g.rawUrl || g.url, description: g.title || '' })), idx)"
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
                  color="success"
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
                class="bg-[#212121]/50 rounded-xl border border-white/5 hover:border-[#4caf50]/30 transition-all p-4 cursor-pointer"
                :class="{
                  'ring-2 ring-[#4caf50] bg-[#4caf50]/10': ver.installed,
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
                        color="success"
                        class="font-medium"
                      >
                        <v-icon x-small left>check_circle</v-icon>
                        {{ t("shared.installed") }}
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
                    :color="ver.installed ? 'grey' : 'success'"
                    :disabled="installing || ver.installed"
                    :loading="installing && selectedVersion?.id === ver.id"
                    @click.stop="onInstall(ver)"
                  >
                    <v-icon left small>{{
                      ver.installed ? "check" : "download"
                    }}</v-icon>
                    {{
                      ver.installed
                        ? t("shared.installed")
                        : t("shared.install")
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
                    >{{ projectId }}</span
                  >
                </div>
                <div
                  class="flex justify-between items-center"
                  v-if="project?.license"
                >
                  <span class="text-gray-400">{{ t("mod.license") }}</span>
                  <a
                    :href="project?.license.url"
                    target="_blank"
                    class="text-[#4caf50] hover:text-[#81c784] transition-colors truncate max-w-[150px] text-right"
                    >{{ project?.license.name }}</a
                  >
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Client Side</span>
                  <span class="text-gray-300">{{ project?.client_side }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Server Side</span>
                  <span class="text-gray-300">{{ project?.server_side }}</span>
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

            <!-- Ad/Promo or Other Info -->
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
  color: #4caf50;
}
:deep(.prose blockquote) {
  border-left-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
}
</style>

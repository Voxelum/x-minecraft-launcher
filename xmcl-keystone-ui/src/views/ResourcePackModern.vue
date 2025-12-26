<template>
  <div class="flex h-full w-full overflow-hidden bg-[rgba(0,0,0,0.2)]">
    <!-- Left Pane: List -->
    <div
      class="flex flex-col w-[350px] min-w-[300px] border-r border-[#4caf50]/20 bg-[#121212]/50 backdrop-blur-sm"
    >
      <!-- Search & Filters Header -->
      <div class="p-4 flex flex-col gap-3 shrink-0">
        <!-- Search Bar -->
        <div
          class="relative flex items-center w-full border border-[#4caf50]/50 rounded-lg bg-[#212121] focus-within:border-[#4caf50] transition-colors"
          :class="{ 'opacity-50': loading }"
        >
          <v-icon small class="ml-3 text-[#4caf50]">search</v-icon>
          <input
            v-model="keywordBuffer"
            class="flex-grow p-2.5 bg-transparent text-white outline-none text-sm"
            :placeholder="t('resourcepack.search')"
            @keydown.enter="updateSearch"
          />
          <v-progress-circular
            v-if="loading"
            indeterminate
            size="16"
            color="success"
            class="mr-3"
          />
        </div>

        <!-- Tabs -->
        <div class="flex p-1 bg-[#212121] rounded-lg">
          <div
            v-for="state in ['market', 'installed']"
            :key="state"
            class="flex-1 text-center py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer rounded transition-all"
            :class="
              activeTab === state
                ? 'bg-[#4caf50] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            "
            @click="activeTab = state"
          >
            {{ state === "market" ? "Resource Market" : t("mod.installed") }}
          </div>
        </div>

        <!-- Filters Row -->
        <div class="flex flex-col gap-3" v-if="activeTab === 'market'">
          <!-- Sort By -->
          <div>
            <span
              class="text-[0.65rem] font-bold text-gray-500 mb-1 block uppercase tracking-wider"
              >Sort By</span
            >
            <div class="flex gap-1 bg-[#212121] p-1 rounded">
              <v-btn
                v-for="(icon, index) in [
                  'sort_by_alpha',
                  'file_download',
                  'star',
                  'history',
                  'new_releases',
                ]"
                :key="icon"
                icon
                x-small
                :class="sort === index ? 'text-[#4caf50]' : 'text-gray-500'"
                @click="sort = index"
              >
                <v-icon small>{{ icon }}</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Modrinth Section -->
          <div
            class="bg-[#1a1a1a] rounded-lg border border-[#4caf50]/20 overflow-hidden mt-2"
          >
            <div
              class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
              @click="isModrinthActive = !isModrinthActive"
            >
              <div class="flex items-center gap-2">
                <v-icon small color="#1bd96a">$vuetify.icons.modrinth</v-icon>
                <span class="text-sm font-semibold text-gray-200"
                  >Modrinth</span
                >
              </div>
              <v-switch
                v-model="isModrinthActive"
                hide-details
                dense
                inset
                class="m-0 p-0"
                color="#1bd96a"
                @click.stop
              ></v-switch>
            </div>
            <div
              v-if="isModrinthActive"
              class="px-3 pb-3 pt-1 border-t border-white/5"
            >
              <div
                class="flex flex-wrap gap-1 max-h-28 overflow-y-auto custom-scroll pr-1"
              >
                <v-chip
                  v-for="cat in modrinthModCategories"
                  :key="cat.name"
                  x-small
                  label
                  class="cursor-pointer transition-all"
                  :class="
                    modrinthCategories.includes(cat.name)
                      ? 'bg-[#1bd96a] text-black font-medium'
                      : 'bg-[#252525] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                  "
                  @click="toggleCategory(cat.name)"
                >
                  <v-avatar left v-if="cat.icon" class="mr-1" size="12">
                    <v-img :src="cat.icon"></v-img>
                  </v-avatar>
                  {{ t(`modrinth.categories.${cat.name}`) }}
                </v-chip>
              </div>
            </div>
          </div>

          <!-- CurseForge Section -->
          <div
            class="bg-[#1a1a1a] rounded-lg border border-[#f57c00]/20 overflow-hidden"
          >
            <div
              class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
              @click="isCurseforgeActive = !isCurseforgeActive"
            >
              <div class="flex items-center gap-2">
                <v-icon small color="#f57c00">$vuetify.icons.curseforge</v-icon>
                <span class="text-sm font-semibold text-gray-200"
                  >CurseForge</span
                >
              </div>
              <v-switch
                v-model="isCurseforgeActive"
                hide-details
                dense
                inset
                class="m-0 p-0"
                color="#f57c00"
                @click.stop
              ></v-switch>
            </div>
            <div
              v-if="isCurseforgeActive"
              class="px-3 pb-3 pt-1 border-t border-white/5"
            >
              <div
                class="flex flex-wrap gap-1 max-h-28 overflow-y-auto custom-scroll pr-1"
              >
                <v-chip
                  :key="'all'"
                  x-small
                  label
                  class="cursor-pointer transition-all"
                  :class="
                    !curseforgeCategory
                      ? 'bg-[#f57c00] text-black font-medium'
                      : 'bg-[#252525] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                  "
                  @click="curseforgeCategory = undefined"
                >
                  All
                </v-chip>
                <v-chip
                  v-for="cat in curseforgeModCategories"
                  :key="cat.id"
                  x-small
                  label
                  class="cursor-pointer transition-all"
                  :class="
                    curseforgeCategory === cat.id
                      ? 'bg-[#f57c00] text-black font-medium'
                      : 'bg-[#252525] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                  "
                  @click="curseforgeCategory = cat.id"
                >
                  <v-avatar left v-if="cat.iconUrl" class="mr-1" size="12">
                    <v-img :src="cat.iconUrl"></v-img>
                  </v-avatar>
                  {{ cat.name }}
                </v-chip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Item List -->
      <div class="flex-grow overflow-auto custom-scroll">
        <!-- Market Items -->
        <div v-if="activeTab === 'market'" class="flex flex-col">
          <div
            v-if="loading && marketItems.length === 0"
            class="flex items-center justify-center py-8"
          >
            <v-progress-circular
              indeterminate
              color="success"
              size="32"
            ></v-progress-circular>
          </div>
          <div
            v-else-if="marketItems.length === 0"
            class="text-center text-gray-500 py-8"
          >
            <v-icon size="48" class="mb-2 opacity-50">search_off</v-icon>
            <p>{{ t("modSearch.noModsFound") }}</p>
          </div>
          <div
            v-for="item in marketItems"
            :key="item.id"
            class="flex gap-3 p-3 border-b border-white/5 cursor-pointer transition-colors"
            :class="
              selectedItem?.id === item.id
                ? 'bg-[#4caf50]/20'
                : 'hover:bg-white/5'
            "
            @click="selectItem(item)"
          >
            <v-img
              :src="item.icon"
              class="w-12 h-12 rounded shrink-0 bg-[#2a2a2a]"
              contain
            >
              <template #placeholder>
                <div
                  class="w-full h-full bg-[#2a2a2a] flex items-center justify-center"
                >
                  <v-icon>image</v-icon>
                </div>
              </template>
            </v-img>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-white truncate text-sm">
                {{ item.title }}
              </h3>
              <p class="text-xs text-gray-400 truncate">
                {{ item.description }}
              </p>
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <v-icon x-small>file_download</v-icon>
                  {{ (item.downloadCount / 1000).toFixed(1) }}k
                </span>
                <span
                  v-if="item.installed?.length"
                  class="text-[#4caf50] flex items-center gap-1"
                >
                  <v-icon x-small color="success">check_circle</v-icon>
                  {{ t("modInstall.installed") }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="marketItems.length > 0" class="flex justify-center py-4">
            <v-btn text color="success" :loading="loading" @click="loadMore">
              {{ t("resourcepack.loadMore") }}
            </v-btn>
          </div>
        </div>

        <!-- Installed Items -->
        <div v-else class="flex flex-col">
          <div
            v-if="localGroupedItems.length === 0"
            class="text-center text-gray-500 py-8 text-sm px-4"
          >
            {{ t("resourcepack.noPacks") }}
          </div>
          <template v-else>
            <template v-for="item in localGroupedItems">
              <!-- Group -->
              <div
                v-if="'projects' in item"
                :key="item.name + '-group'"
                class="flex flex-col"
              >
                <div
                  class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-white/5 border-l-2 select-none"
                  :class="
                    groupCollapsedState[item.name]
                      ? 'border-transparent text-gray-400'
                      : 'border-[#4caf50] bg-white/5 text-white'
                  "
                  @click="toggleGroupCollapsed(item.name)"
                  @contextmenu.prevent="onContextMenu($event, item)"
                >
                  <v-icon
                    small
                    class="transition-transform duration-200"
                    :class="{ '-rotate-90': groupCollapsedState[item.name] }"
                    >expand_more</v-icon
                  >
                  <span class="font-bold text-sm truncate flex-1">{{
                    item.name
                  }}</span>
                  <span class="text-xs text-gray-500" v-if="item.projects">{{
                    item.projects.length
                  }}</span>
                </div>
                <div
                  v-show="!groupCollapsedState[item.name]"
                  class="flex flex-col pl-2 border-l border-white/5 ml-3"
                >
                  <div
                    v-for="subItem in item.projects"
                    :key="subItem.id"
                    class="flex gap-3 p-2 border-b border-white/5 cursor-pointer transition-colors rounded-r hover:bg-white/5"
                    :class="
                      selectedItem?.id === subItem.id ? 'bg-[#4caf50]/20' : ''
                    "
                    @click="selectItem(subItem)"
                    @contextmenu.prevent="onContextMenu($event, subItem)"
                  >
                    <v-img
                      :src="subItem.icon"
                      class="w-10 h-10 rounded shrink-0 bg-[#2a2a2a]"
                      contain
                    >
                      <template #placeholder>
                        <div
                          class="w-full h-full bg-[#2a2a2a] flex items-center justify-center"
                        >
                          <v-icon small>image</v-icon>
                        </div>
                      </template>
                    </v-img>
                    <div class="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 class="font-bold text-gray-200 truncate text-xs">
                        {{ subItem.title }}
                      </h3>
                      <p class="text-[10px] text-gray-500 truncate">
                        {{ subItem.description }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Single Item -->
              <div
                v-else
                :key="(item.id || item.name) + '-item'"
                class="flex gap-3 p-2 border-b border-white/5 cursor-pointer transition-colors rounded hover:bg-white/5"
                :class="selectedItem?.id === item.id ? 'bg-[#4caf50]/20' : ''"
                @click="selectItem(item)"
                @contextmenu.prevent="onContextMenu($event, item)"
              >
                <v-img
                  :src="item.icon"
                  class="w-10 h-10 rounded shrink-0 bg-[#2a2a2a]"
                  contain
                >
                  <template #placeholder>
                    <div
                      class="w-full h-full bg-[#2a2a2a] flex items-center justify-center"
                    >
                      <v-icon small>image</v-icon>
                    </div>
                  </template>
                </v-img>
                <div class="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 class="font-bold text-white truncate text-xs">
                    {{ item.title }}
                  </h3>
                  <p class="text-[10px] text-gray-400 truncate">
                    {{ item.description }}
                  </p>
                  <div
                    class="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500"
                  >
                    <span
                      v-if="item.installed?.length"
                      class="text-[#4caf50] flex items-center gap-1"
                    >
                      <v-icon x-small color="success" size="10"
                        >check_circle</v-icon
                      >
                      {{ t("modInstall.installed") }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- Right Pane: Details -->
    <div
      class="flex-grow flex flex-col h-full bg-[#121212]/80 relative overflow-hidden"
    >
      <template v-if="selectedItem">
        <MarketProjectDetailModrinthModern
          v-if="shouldShowModrinth(selectedItem)"
          :modrinth="selectedItem.modrinth"
          :project-id="selectedModrinthId"
          :installed="selectedItem.installed || []"
          :game-version="gameVersion"
          :categories="modrinthCategories"
          :all-files="resourcePacks"
          :curseforge="Number(selectedCurseforgeId)"
          class="h-full"
          @uninstall="onUninstall"
          @category="toggleCategory"
        />
        <MarketProjectDetailCurseforgeModern
          v-else-if="shouldShowCurseforge(selectedItem)"
          :curseforge="selectedItem.curseforge"
          :curseforge-id="Number(selectedCurseforgeId)"
          :installed="selectedItem.installed || []"
          :game-version="gameVersion"
          :category="curseforgeCategory"
          :all-files="resourcePacks"
          :modrinth="selectedModrinthId"
          class="h-full"
          @uninstall="onUninstall"
          @category="curseforgeCategory = $event"
        />
        <div
          v-else
          class="flex flex-col items-center justify-center h-full text-gray-500"
        >
          <v-icon size="64" class="mb-4 text-gray-600">extension</v-icon>
          <p>{{ t("resourcepack.name") }}</p>
        </div>
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center h-full text-gray-500 bg-transparent"
      >
        <div class="text-center">
          <v-icon size="96" class="mb-6 text-[#4caf50]/20">touch_app</v-icon>
          <h3 class="text-2xl font-bold text-gray-300 mb-2">
            {{ t("resourcepack.manage") }}
          </h3>
          <p class="text-gray-500 max-w-md mx-auto">
            {{ t("resourcepack.searchHint") }}
          </p>
        </div>
      </div>
    </div>
    <ModGroupSelectDialog />
  </div>
</template>

<script lang="ts" setup>
import { injection } from "@/util/inject";
import { kResourcePackSearch } from "@/composables/resourcePackSearch";
import { kSearchModel } from "@/composables/search";
import { kInstance } from "@/composables/instance";
import { kInstanceResourcePacks } from "@/composables/instanceResourcePack";
import debounce from "lodash.debounce";
import { useService } from "@/composables";
import { InstanceResourcePacksServiceKey } from "@xmcl/runtime-api";
import MarketProjectDetailModrinthModern from "@/components/MarketProjectDetailModrinthModern.vue";
import MarketProjectDetailCurseforgeModern from "@/components/MarketProjectDetailCurseforgeModern.vue";
import { useToggleCategories } from "@/composables/toggleCategories";
import { kInstanceDefaultSource } from "@/composables/instanceDefaultSource";
import { kCurseforgeCategories } from "@/composables/curseforge";
import { kModrinthTags } from "@/composables/modrinth";

import { useModGroups } from "@/composables/modGroup";
import { useContextMenu } from "@/composables/contextMenu";
import { useDialog } from "@/composables/dialog";
import ModGroupSelectDialog from "./ModGroupSelectDialog.vue";

const { t } = useI18n();
const {
  items,
  loading,
  loadMore,
  sortBy: searchSortBy,
} = injection(kResourcePackSearch);
const {
  keyword,
  source,
  modrinthCategories,
  curseforgeCategory,
  gameVersion,
  isCurseforgeActive,
  isModrinthActive,
  sort,
} = injection(kSearchModel);
const { path, showInstanceFolder } = injection(kInstance);
const { resourcePacks } = injection(kInstanceResourcePacks);
const { uninstall } = useService(InstanceResourcePacksServiceKey);
const defaultSource = injection(kInstanceDefaultSource);

const activeTab = ref("market");
const keywordBuffer = ref("");
const selectedItem = ref(undefined as any);

// Folder/Group Logic
const isLocalView = computed(() => activeTab.value === "installed");
const { localGroupedItems, groupCollapsedState, toggleGroupCollapsed, getContextMenuItemsForGroup, addToGroup, group } = useModGroups(isLocalView, path, items as any, searchSortBy);
const { show: showGroupSelectDialog } = useDialog("mod-group-select");

// Context Menu
const { open: openContextMenu } = useContextMenu();

function showGroupDialog(fileNames: string[]) {
  showGroupSelectDialog({
    groups: localGroupedItems.value
      .filter((i) => "projects" in i)
      .reduce(
        (acc, g: any) => ({ ...acc, [g.name]: { files: [], color: "" } }),
        {}
      ),
    onSelect: (groupName: string | null, newName?: string) => {
      if (groupName) {
        addToGroup(fileNames, groupName);
      } else if (newName) {
        group(fileNames, newName);
      }
    },
  });
}

const onContextMenu = (e: MouseEvent, item: any) => {
  if (activeTab.value !== "installed") return;

  // Get group-related items
  const groupItems = getContextMenuItemsForGroup(item, showGroupDialog);

  // Add resource pack-specific actions for non-group items
  const resourceItems: any[] = [];
  if (!("projects" in item) && item.installed?.length > 0) {
    // Uninstall
    resourceItems.push({
      icon: "delete",
      text: t("delete"),
      onClick: () => {
        onUninstall(item.installed);
      },
    });
  }

  const allItems = [...groupItems, ...resourceItems];
  if (allItems.length > 0) {
    openContextMenu(e.clientX, e.clientY, allItems);
  }
};

// Inject curseforge categories
const { categories: curseforgeCategories } = injection(kCurseforgeCategories);
const curseforgeModCategories = computed(() => {
  const cats = curseforgeCategories.value;
  if (!cats) return [];
  const parent = cats.find((c) => c.slug === "texture-packs");
  return cats.filter((c) => c.parentCategoryId === parent?.id);
});

// Inject modrinth tags
const { categories: modrinthTags } = injection(kModrinthTags);
const modrinthModCategories = computed(() => {
  return modrinthTags.value.filter((c) => c.project_type === "resourcepack");
});

// Market items (remote search results)
const marketItems = computed(() => {
  return items.value.filter((item) => typeof item === "object" && item.id);
});

// Local items (installed resource packs)
const localItems = computed(() => {
  return items.value.filter(
    (item) => typeof item === "object" && item.id && item.installed?.length > 0
  );
});

// Computed for Details
const selectedModrinthId = computed(
  () =>
    selectedItem.value?.modrinth?.project_id ||
    selectedItem.value?.modrinthProjectId ||
    ""
);
const selectedCurseforgeId = computed(
  () =>
    selectedItem.value?.curseforge?.id ||
    selectedItem.value?.curseforgeProjectId ||
    0
);

const shouldShowModrinth = (item: any) => {
  if (item?.modrinth) return true;
  if (item?.curseforge) return false;
  const hasModrinth = item?.modrinth || item?.modrinthProjectId;
  if (!hasModrinth) return false;
  const hasCurseforge = item?.curseforge || item?.curseforgeProjectId;
  if (defaultSource.value === "curseforge" && hasCurseforge) return false;
  return true;
};

const shouldShowCurseforge = (item: any) => {
  if (item?.curseforge) return true;
  const hasCurseforge = item?.curseforge || item?.curseforgeProjectId;
  if (!hasCurseforge) return false;
  const hasModrinth = item?.modrinth || item?.modrinthProjectId;
  if (defaultSource.value === "modrinth" && hasModrinth) return false;
  return true;
};

// Watch tab changes to update source
watch(activeTab, (val) => {
  if (val === "market") {
    source.value = "remote";
  } else {
    source.value = "local";
  }
});

// Initialize with market tab - set source immediately at script level
source.value = "remote";

// Select item
const selectItem = (item: any) => {
  selectedItem.value = item;
};

// Categories
const toggleCategory = useToggleCategories(modrinthCategories);

// Search logic
const updateSearch = debounce(() => {
  keyword.value = keywordBuffer.value;
}, 500);

watch(keywordBuffer, () => {
  updateSearch();
});

const onUninstall = (files: any[]) => {
  uninstall({ path: path.value, files: files.map((f) => f.path) });
};
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 8px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

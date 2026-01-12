<template>
  <div class="flex h-full w-full overflow-hidden bg-[rgba(0,0,0,0.2)]">
    <!-- Left Pane: List -->
    <div
      class="mod-left-pane flex flex-col border-r border-[#4caf50]/20 bg-[#121212]/50 backdrop-blur-sm"
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
            :placeholder="t('modInstall.search')"
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
            v-for="state in ['market', 'installed', 'collection']"
            :key="state"
            class="flex-1 text-center py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer rounded transition-all"
            :class="
              activeTab === state
                ? 'bg-[#4caf50] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            "
            @click="selectTab(state)"
          >
            {{
              state === "market"
                ? "Mod Market"
                : state === "collection"
                ? "Collection"
                : t("mod.installed")
            }}
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

          <!-- Minecraft Version -->
          <div>
            <span
              class="text-[0.65rem] font-bold text-gray-500 mb-1 block uppercase tracking-wider"
              >Minecraft Version</span
            >
            <div class="flex gap-1 overflow-x-auto custom-scroll pb-1">
              <div
                class="px-2 py-1 rounded text-xs cursor-pointer whitespace-nowrap transition-colors"
                :class="
                  gameVersion === ''
                    ? 'bg-[#4caf50] text-white font-bold'
                    : 'bg-[#212121] text-gray-400 hover:text-gray-200'
                "
                @click="gameVersion = ''"
              >
                All
              </div>
              <div
                v-for="v in minecraftVersions"
                :key="v.id"
                class="px-2 py-1 rounded text-xs cursor-pointer whitespace-nowrap transition-colors"
                :class="
                  gameVersion === v.id
                    ? 'bg-[#4caf50] text-white font-bold'
                    : 'bg-[#212121] text-gray-400 hover:text-gray-200'
                "
                @click="gameVersion = v.id"
              >
                {{ v.id }}
              </div>
            </div>
          </div>

          <!-- Mod Loaders -->
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <span
                class="text-[0.65rem] font-bold text-gray-500 mb-1 block uppercase tracking-wider"
                >Mod Loaders</span
              >
              <div
                class="flex gap-1 bg-[#1a1a1a] p-1.5 rounded-lg border border-white/5"
              >
                <v-btn
                  icon
                  x-small
                  :class="
                    !modLoader
                      ? 'bg-[#4caf50] text-white'
                      : 'text-gray-500 hover:text-white'
                  "
                  @click="modLoader = undefined"
                  v-shared-tooltip="'All'"
                >
                  <v-icon small>apps</v-icon>
                </v-btn>
                <v-btn
                  v-for="loader in [
                    ModLoaderFilter.forge,
                    ModLoaderFilter.neoforge,
                    ModLoaderFilter.fabric,
                    ModLoaderFilter.quilt,
                  ]"
                  :key="loader"
                  icon
                  x-small
                  :class="
                    modLoader === loader
                      ? 'bg-white/10 text-white ring-1 ring-white/30'
                      : 'text-gray-500 hover:text-white'
                  "
                  @click="modLoader = modLoader === loader ? undefined : loader"
                  v-shared-tooltip="loader"
                >
                  <img
                    :src="
                      BuiltinImages[
                        loader === 'neoforge' ? 'neoForged' : loader
                      ]
                    "
                    class="w-4 h-4 object-contain"
                    :class="{
                      'grayscale opacity-40': modLoader !== loader && modLoader,
                    }"
                  />
                </v-btn>
              </div>
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
                  @click="
                    curseforgeCategory =
                      curseforgeCategory === cat.id ? undefined : cat.id
                  "
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
        <div class="flex gap-2 items-center" v-else>
          <!-- Installed Filters -->
          <v-select
            v-model="sortBy"
            :items="sortOptions"
            item-text="text"
            item-value="value"
            label="Sort"
            outlined
            dense
            hide-details
            class="dark-select text-xs flex-grow"
          />
        </div>
      </div>

      <!-- List Content -->
      <div
        class="flex-grow overflow-y-auto custom-scroll px-2 pb-2 flex flex-col gap-2"
      >
        <template v-if="loading && displayItems.length === 0">
          <div class="p-4 text-center">
            <v-progress-circular
              indeterminate
              color="#4caf50"
              size="32"
            ></v-progress-circular>
          </div>
        </template>
        <template
          v-else-if="displayItems.length === 0 && activeTab !== 'installed'"
        >
          <div class="text-center text-gray-500 py-8 text-sm px-4">
            {{
              activeTab === "market"
                ? t("modSearch.noModsFound")
                : t("mod.noModInstalled")
            }}
          </div>
        </template>

        <!-- Installed Items (Grouped) -->
        <template v-else-if="activeTab === 'installed'">
          <div
            v-if="localGroupedItems.length === 0"
            class="text-center text-gray-500 py-8 text-sm px-4"
          >
            {{ t("modSearch.noLocalModsFound") }}
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
                :key="(item.id) + '-item'"
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
        </template>

        <!-- Market Items (Flat) with Load More -->
        <template v-else>
          <ModItem
            v-for="item in displayItems"
            :key="getItemKey(item)"
            :item="item"
            :selection-mode="false"
            :checked="false"
            :selected="isItemSelected(item)"
            :item-height="60"
            :install="onInstall"
            dense
            class="rounded transition-all cursor-pointer border border-transparent"
            :class="
              isItemSelected(item)
                ? 'bg-[#4caf50]/20 border-[#4caf50]/50'
                : 'hover:bg-white/5 bg-transparent'
            "
            @click="selectItem(item)"
          />
          <div
            v-if="activeTab === 'market' && !loading"
            class="p-2 text-center"
          >
            <v-btn small text block :loading="loading" @click="loadMore">
              Load More
            </v-btn>
          </div>
        </template>
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
          :all-files="mods"
          :curseforge="
            selectedItem.curseforge?.id || selectedItem.curseforgeProjectId
          "
          class="h-full"
          @uninstall="onUninstall"
          @enable="onEnable"
          @disable="onDisable"
          @category="toggleCategory"
        />
        <MarketProjectDetailCurseforgeModern
          v-else-if="shouldShowCurseforge(selectedItem)"
          :curseforge="selectedItem.curseforge"
          :curseforge-id="Number(selectedCurseforgeId)"
          :installed="selectedItem.installed || []"
          :game-version="gameVersion"
          :category="curseforgeCategory"
          :all-files="mods"
          :modrinth="selectedModrinthId"
          class="h-full"
          @uninstall="onUninstall"
          @enable="onEnable"
          @disable="onDisable"
          @category="curseforgeCategory = $event"
        />
        <div
          v-else
          class="flex flex-col items-center justify-center h-full text-gray-500"
        >
          <v-icon size="64" class="mb-4 text-gray-600">extension</v-icon>
          <p>Select a mod to view details</p>
        </div>
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center h-full text-gray-500 bg-transparent"
      >
        <div class="text-center">
          <v-icon size="96" class="mb-6 text-[#4caf50]/20">touch_app</v-icon>
          <h3 class="text-2xl font-bold text-gray-300 mb-2">
            {{ t("mod.manage") }}
          </h3>
          <p class="text-gray-500 max-w-md mx-auto">
            {{ t("mod.manageHint") }}
          </p>
        </div>
      </div>
    </div>
    <ModGroupSelectDialog />
  </div>
</template>

<script lang="ts" setup>
import { injection } from "@/util/inject";
import { kModsSearch } from "@/composables/modSearch";
import { kSearchModel, ModLoaderFilter } from "@/composables/search";
import { kInstance } from "@/composables/instance";
import { kModDependenciesCheck } from "@/composables/modDependenciesCheck";
import { kModLibCleaner } from "@/composables/modLibCleaner";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import debounce from "lodash.debounce";
import ModItem from "./ModItem.vue";
import { useService } from "@/composables";
import { InstanceModsServiceKey } from "@xmcl/runtime-api";
import MarketProjectDetailModrinthModern from "@/components/MarketProjectDetailModrinthModern.vue";
import MarketProjectDetailCurseforgeModern from "@/components/MarketProjectDetailCurseforgeModern.vue";
import { ProjectEntry, ProjectFile } from "@/util/search";
import { ModFile } from "@/util/mod";
import { kInstanceModsContext } from "@/composables/instanceMods";
import { useToggleCategories } from "@/composables/toggleCategories";
import { kInstanceDefaultSource } from "@/composables/instanceDefaultSource";
import { useMinecraftVersions } from "@/composables/version";
import { BuiltinImages } from "@/constant";
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
} = injection(kModsSearch);
const {
  keyword,
  modLoader,
  gameVersion,
  isCurseforgeActive,
  isModrinthActive,
  modrinthCategories,
  curseforgeCategory,
  sort,
  modLoaders,
  source,
} = injection(kSearchModel);
const { path, runtime } = injection(kInstance);
const { install, uninstall, enable, disable } = useService(
  InstanceModsServiceKey
);
const { mods } = injection(kInstanceModsContext);
const defaultSource = injection(kInstanceDefaultSource);

const { versions: minecraftVersions } = useMinecraftVersions();

// Inject curseforge categories
const { categories: curseforgeCategories } = injection(kCurseforgeCategories);
const curseforgeModCategories = computed(() => {
  const cats = curseforgeCategories.value;
  if (!cats) return [];
  const parent = cats.find((c) => c.slug === "mc-mods");
  return cats.filter((c) => c.parentCategoryId === parent?.id);
});

// Inject modrinth tags
const { categories: modrinthTags } = injection(kModrinthTags);
const modrinthModCategories = computed(() => {
  return modrinthTags.value.filter((c) => c.project_type === "mod");
});

const activeTab = ref("market" as "market" | "installed" | "collection");
const keywordBuffer = ref("");
const selectedItem = ref(undefined as ProjectEntry | undefined);

const selectTab = (state: string) => {
  activeTab.value = state as any;
};

// Folder/Group Logic
const isLocalView = computed(() => activeTab.value === "installed");
const {
  localGroupedItems,
  groupCollapsedState,
  toggleGroupCollapsed,
  getContextMenuItemsForGroup,
  addToGroup,
  group,
} = useModGroups(isLocalView, path, items, searchSortBy);
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

  // Build mod-specific items manually (can't use composable inside handler)
  let modItems: any[] = [];
  if (!("projects" in item) && item.installed?.length > 0) {
    const installedFiles = item.installed;
    const isEnabled = installedFiles[0]?.enabled !== false;

    // Enable/Disable toggle
    modItems.push({
      icon: isEnabled ? "toggle_off" : "toggle_on",
      text: isEnabled ? t("disable") : t("enable"),
      onClick: () => {
        if (isEnabled) {
          disable({
            path: path.value,
            files: installedFiles.map((i: any) => i.path),
          });
        } else {
          enable({
            path: path.value,
            files: installedFiles.map((i: any) => i.path),
          });
        }
      },
    });

    // Delete/Uninstall
    modItems.push({
      icon: "delete",
      text: t("delete"),
      onClick: () => {
        uninstall({
          path: path.value,
          files: installedFiles.map((i: any) => i.path),
        });
      },
    });
  }

  const allItems = [...groupItems, ...modItems];
  if (allItems.length > 0) {
    openContextMenu(e.clientX, e.clientY, allItems);
  }
};

// Sync tab with source
watch(activeTab, (val) => {
  if (val === "market") {
    source.value = "remote";
    // Reset selection if switching to market as items change
    selectedItem.value = undefined;
  } else if (val === "collection") {
    source.value = "favorite";
    selectedItem.value = undefined;
  } else {
    source.value = "local";
    selectedItem.value = undefined;
  }
});

// Search Logic - Trigger immediately on input
watch(
  keywordBuffer,
  debounce((v) => {
    keyword.value = v;
  }, 300),
  { immediate: true }
);

// For enter key - immediate search
const updateSearch = () => {
  keyword.value = keywordBuffer.value;
};

const sortOptions = computed(() => [
  { text: "Name (A-Z)", value: "alpha_asc" },
  { text: "Name (Z-A)", value: "alpha_desc" },
  { text: "Date (Newest)", value: "time_desc" },
  { text: "Date (Oldest)", value: "time_asc" },
]);
// Mapping for v-select
const sortBy = computed({
  get: () => searchSortBy.value,
  set: (v) => (searchSortBy.value = v as any),
});

const displayItems = computed(() => items.value);

const getItemKey = (item: ProjectEntry) => item.id;

const isItemSelected = (item: ProjectEntry) =>
  selectedItem.value?.id === item.id;

const selectItem = (item: ProjectEntry) => {
  selectedItem.value = item;
};

// Installation Logic
const onInstall = async (p: ProjectEntry) => {
  // Add logic to install specific version or latest?
  // Usually ModItem install triggers specific logic.
  // For now, assume it installs appropriate version or opens dialog
  if (p.modrinth) {
    // Simple install latest logic or delegate to detail view via selection?
    // Ideally clicking install on list item should just select it and show detail, OR quick install?
    // Let's make it select item first
    selectItem(p);
  }
};

const onUninstall = (f: ProjectFile[]) => {
  uninstall({ path: path.value, files: f.map((f) => f.path) });
};
const onEnable = (f: ProjectFile) => {
  enable({ path: path.value, files: [f.path] });
};
const onDisable = (f: ProjectFile) => {
  disable({ path: path.value, files: [f.path] });
};

// Categories
const toggleCategory = useToggleCategories(modrinthCategories);

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

const shouldShowModrinth = (selectedItem: ProjectEntry) => {
  if (selectedItem?.modrinth) return true;
  if (selectedItem?.curseforge) return false;
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId.value;
  if (!hasModrinth) return false;
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId.value;
  if (defaultSource.value === "curseforge" && hasCurseforge) return false;
  return true;
};

const shouldShowCurseforge = (selectedItem: ProjectEntry) => {
  if (selectedItem?.curseforge) return true;
  const hasCurseforge = selectedItem?.curseforge || selectedCurseforgeId.value;
  if (!hasCurseforge) return false;
  const hasModrinth = selectedItem?.modrinth || selectedModrinthId.value;
  if (defaultSource.value === "modrinth" && hasModrinth) return false;
  return true;
};

// NOTE: effect() is already called by parent Mod.vue - do NOT call it here
// Calling it twice breaks the watchers and causes a blank screen

// Set initial source to remote to show market mods
source.value = "remote";

onMounted(() => {
  activeTab.value = "market";
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
.dark-select :deep(.v-input__control) {
  background-color: #212121 !important;
  border-color: rgba(76, 175, 80, 0.5) !important;
}
.dark-select.v-input--is-focused :deep(.v-input__control) {
  border-color: #4caf50 !important;
}

/* Responsive left pane */
.mod-left-pane {
  width: 350px;
  min-width: 280px;
  max-width: 400px;
  transition: width 0.3s ease;
}

/* Medium screens (tablets) */
@media (max-width: 1024px) {
  .mod-left-pane {
    width: 280px;
    min-width: 250px;
  }
}

/* Small screens */
@media (max-width: 768px) {
  .mod-left-pane {
    width: 240px;
    min-width: 200px;
  }
}

/* Very small screens */
@media (max-width: 600px) {
  .mod-left-pane {
    width: 100%;
    min-width: unset;
    max-width: unset;
  }
}
</style>

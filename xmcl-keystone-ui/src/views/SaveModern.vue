<template>
  <div class="flex h-full w-full overflow-hidden bg-[rgba(0,0,0,0.2)]">
    <!-- Left Pane: List -->
    <div
      class="flex flex-col w-[400px] min-w-[350px] border-r border-[#f57c00]/20 bg-[#121212]/50 backdrop-blur-sm"
    >
      <!-- Search & Filters Header -->
      <div class="p-4 flex flex-col gap-3 shrink-0">
        <!-- Tabs -->
        <div class="flex p-1 bg-[#212121] rounded-lg">
          <div
            v-for="state in ['market', 'installed']"
            :key="state"
            class="flex-1 text-center py-1.5 text-xs font-bold uppercase tracking-wider cursor-pointer rounded transition-all"
            :class="
              activeTab === state
                ? 'bg-[#f57c00] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            "
            @click="activeTab = state"
          >
            {{ state === "market" ? t("mod.market") : t("mod.installed") }}
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
              color="warning"
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
                ? 'bg-[#f57c00]/20'
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
                  class="text-[#f57c00] flex items-center gap-1"
                >
                  <v-icon x-small color="warning">check_circle</v-icon>
                  {{ t("modInstall.installed") }}
                </span>
              </div>
            </div>
          </div>
          <div v-if="marketItems.length > 0" class="flex justify-center py-4">
            <v-btn text color="warning" :loading="loading" @click="loadMore">
              {{ t("save.loadMore") }}
            </v-btn>
          </div>
        </div>

        <!-- Installed Items -->
        <div v-else class="flex flex-col">
          <div
            v-if="localItems.length === 0"
            class="text-center text-gray-500 py-8"
          >
            {{ t("save.noSaves") }}
          </div>
          <div
            v-for="item in localItems"
            :key="item.id"
            class="flex gap-3 p-3 border-b border-white/5 cursor-pointer transition-colors"
            :class="
              selectedItem?.id === item.id
                ? 'bg-[#f57c00]/20'
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
                  <v-icon>map</v-icon>
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
                <span
                  v-if="item.installed?.length"
                  class="text-[#f57c00] flex items-center gap-1"
                >
                  <v-icon x-small color="warning">check_circle</v-icon>
                  {{ t("modInstall.installed") }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Pane: Details -->
    <div
      class="flex-grow flex flex-col h-full bg-[#121212]/80 relative overflow-hidden"
    >
      <template v-if="selectedItem">
        <MarketProjectDetailCurseforgeModern
          v-if="selectedItem.curseforge || selectedItem.curseforgeProjectId"
          :curseforge="selectedItem.curseforge"
          :curseforge-id="Number(selectedCurseforgeId)"
          :installed="selectedItem.installed || []"
          :game-version="gameVersion"
          :category="curseforgeCategory"
          :all-files="[]"
          class="h-full"
          @category="curseforgeCategory = $event"
        />
        <!-- Local Save Detail -->
        <div
          v-else-if="selectedItem.installed?.length > 0"
          class="h-full overflow-auto p-6"
        >
          <div class="max-w-2xl mx-auto">
            <div class="flex gap-4 mb-6">
              <v-img
                :src="selectedItem.icon"
                class="w-24 h-24 rounded-lg shrink-0 bg-[#2a2a2a]"
                contain
              >
                <template #placeholder>
                  <div
                    class="w-full h-full bg-[#2a2a2a] flex items-center justify-center"
                  >
                    <v-icon size="32">map</v-icon>
                  </div>
                </template>
              </v-img>
              <div>
                <h2 class="text-2xl font-bold text-white">
                  {{ selectedItem.title }}
                </h2>
                <p class="text-gray-400 mt-1">{{ selectedItem.description }}</p>
              </div>
            </div>
            <div class="flex gap-2 mt-4">
              <v-btn
                color="error"
                outlined
                @click="onDelete(selectedItem.installed[0])"
              >
                <v-icon left>delete</v-icon>
                {{ t("delete.name", { name: selectedItem.title }) }}
              </v-btn>
            </div>
          </div>
        </div>
        <div
          v-else
          class="flex flex-col items-center justify-center h-full text-gray-500"
        >
          <v-icon size="64" class="mb-4 text-gray-600">map</v-icon>
          <p>{{ t("save.name") }}</p>
        </div>
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center h-full text-gray-500 bg-transparent"
      >
        <div class="text-center">
          <v-icon size="96" class="mb-6 text-[#f57c00]/20">touch_app</v-icon>
          <h3 class="text-2xl font-bold text-gray-300 mb-2">
            {{ t("save.manage") }}
          </h3>
          <p class="text-gray-500 max-w-md mx-auto">
            {{ t("save.searchHint") }}
          </p>
        </div>
      </div>
    </div>

    <SimpleDialog
      v-model="model"
      :title="t('save.deleteTitle')"
      :width="500"
      persistent
      @confirm="doDelete()"
    >
      {{ t("save.deleteHint") }}
      <div style="color: grey">
        {{ deleting?.path }}
      </div>
    </SimpleDialog>
  </div>
</template>

<script lang="ts" setup>
import { injection } from "@/util/inject";
import { kSaveSearch } from "@/composables/savesSearch";
import { kSearchModel } from "@/composables/search";
import { kInstance } from "@/composables/instance";
import { kInstanceSave, InstanceSaveFile } from "@/composables/instanceSave";
import debounce from "lodash.debounce";
import SimpleDialog from "../components/SimpleDialog.vue";
import { useSimpleDialog } from "../composables/dialog";
import MarketProjectDetailCurseforgeModern from "@/components/MarketProjectDetailCurseforgeModern.vue";

const { t } = useI18n();
const { items, loading, loadMore, sortBy, effect } = injection(kSaveSearch);
const { keyword, source, curseforgeCategory, gameVersion } =
  injection(kSearchModel);
const { path, showInstanceFolder } = injection(kInstance);
const { deleteSave } = injection(kInstanceSave);

// Initialize search effect
effect();

const activeTab = ref("market");
const selectedItem = ref(undefined as any);

// Market items (remote search results)
const marketItems = computed(() => {
  return items.value.filter(
    (item) => typeof item === "object" && item.id && item.curseforgeProjectId
  );
});

// Local items (installed saves)
const localItems = computed(() => {
  return items.value.filter(
    (item) => typeof item === "object" && item.id && item.installed?.length > 0
  );
});

// Computed for Details
const selectedCurseforgeId = computed(
  () =>
    selectedItem.value?.curseforge?.id ||
    selectedItem.value?.curseforgeProjectId ||
    0
);

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

// Delete logic
const {
  target: deleting,
  confirm: doDelete,
  model,
  show,
} = useSimpleDialog<InstanceSaveFile>((save) =>
  save ? deleteSave(save) : undefined
);

const onDelete = (save: InstanceSaveFile) => {
  show(save);
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

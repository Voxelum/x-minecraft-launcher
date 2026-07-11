<template>
  <div
    v-if="!isBedrock || bedrockStorage"
    v-roving-tabindex
    role="toolbar"
    aria-orientation="horizontal"
    :aria-label="t('baseSetting.title', 2)"
    class="grid xl:gap-4 gap-1 home-actions"
    :style="{
      'grid-template-columns': `repeat(${
        isBedrock ? 2 : 3
      }, minmax(0, 1fr))`,
    }"
  >
    <v-btn
      data-testid="home-log-action"
      v-shared-tooltip="() => isBedrock ? t('instance.openLogFolder') : t('logsCrashes.title')"
      icon
      variant="text"
      density="comfortable"
      :loading="isValidating || loadingBedrockStorage"
      :aria-label="isBedrock ? t('instance.openLogFolder') : t('logsCrashes.title')"
      @click="showLogs"
    >
      <v-icon> subtitles </v-icon>
    </v-btn>

    <v-btn
      data-testid="home-folder-action"
      v-shared-tooltip="() => t('instance.showInstance')"
      icon
      variant="text"
      density="comfortable"
      :loading="isValidating || loadingBedrockStorage"
      :aria-label="t('instance.showInstance')"
      @click="showInstanceFolder"
    >
      <v-icon> folder </v-icon>
    </v-btn>

    <v-btn
      v-if="!isBedrock"
      v-shared-tooltip="() => t('modpack.export')"
      icon
      variant="text"
      density="comfortable"
      :loading="isValidating"
      :aria-label="t('modpack.export')"
      to="/base-setting?target=modpack"
    >
      <v-icon> share </v-icon>
    </v-btn>
  </div>
</template>

<script lang="ts" setup>
import { useService } from "@/composables";
import { kInstance } from "@/composables/instance";
import { kInstances } from "@/composables/instances";
import { vRovingTabindex } from "@/directives/rovingTabindex";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import { injection } from "@/util/inject";
import { BaseServiceKey, BedrockServiceKey, BedrockStoragePaths } from "@xmcl/runtime-api";
import { isBedrockInstance } from "@xmcl/instance";
import { useDialog } from "../composables/dialog";

const { path, instance } = injection(kInstance);
const { isValidating } = injection(kInstances);
const isBedrock = computed(() => isBedrockInstance(instance.value));
const { openDirectory } = useService(BaseServiceKey);
const { getStoragePaths } = useService(BedrockServiceKey);
const { show: showLogDialog } = useDialog("log");
const { t } = useI18n();

const bedrockStorage = ref<BedrockStoragePaths>();
const loadingBedrockStorage = ref(false);

watch(isBedrock, async (bedrock) => {
  bedrockStorage.value = undefined;
  if (!bedrock) return;
  loadingBedrockStorage.value = true;
  try {
    bedrockStorage.value = await getStoragePaths();
  } finally {
    loadingBedrockStorage.value = false;
  }
}, { immediate: true });

function showInstanceFolder() {
  openDirectory(isBedrock.value ? bedrockStorage.value!.dataPath : path.value);
}

function showLogs() {
  if (isBedrock.value) {
    openDirectory(bedrockStorage.value!.logsPath);
    return;
  }
  showLogDialog();
}
</script>
<style scoped>
.compact {
  background: rgba(0, 0, 0, 0.5);
}
</style>

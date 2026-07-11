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
        instance && !instance.upstream ? 3 : 2
      }, minmax(0, 1fr))`,
    }"
  >
    <v-btn
      data-testid="base-setting-log-action"
      v-shared-tooltip.left="() => isBedrock ? t('instance.openLogFolder') : t('logsCrashes.title')"
      variant="text"
      icon
      :loading="isValidating || loadingBedrockStorage"
      @click="showLogs"
    >
      <v-icon> subtitles </v-icon>
    </v-btn>
    <v-btn
      data-testid="base-setting-folder-action"
      v-shared-tooltip.left="() => t('instance.showInstance')"
      variant="text"
      icon
      :loading="isValidating || loadingBedrockStorage"
      @click="showInstanceFolder"
    >
      <v-icon> folder </v-icon>
    </v-btn>
    <v-btn
      v-if="instance && !instance.upstream && !isBedrock"
      v-shared-tooltip.left="() => t('instance.installModpack')"
      variant="text"
      icon
      :loading="isValidating || loading"
      @click="onClickInstallFromModpack()"
    >
      <v-icon> drive_folder_upload </v-icon>
    </v-btn>
  </div>
</template>

<script lang="ts" setup>
import { useService } from "@/composables";
import { kInstance } from "@/composables/instance";
import { InstanceInstallDialog } from "@/composables/instanceUpdate";
import { kInstances } from "@/composables/instances";
import { vRovingTabindex } from "@/directives/rovingTabindex";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import { injection } from "@/util/inject";
import {
  BaseServiceKey,
  BedrockServiceKey,
  BedrockStoragePaths,
  ModpackServiceKey,
  waitModpackFiles,
} from "@xmcl/runtime-api";
import { useDialog } from "../composables/dialog";
import { isBedrockInstance } from "@xmcl/instance";

const { path, instance } = injection(kInstance);
const { isValidating } = injection(kInstances);
const isBedrock = computed(() => isBedrockInstance(instance.value));
const { openDirectory } = useService(BaseServiceKey);
const { getStoragePaths } = useService(BedrockServiceKey);
const { show: showLogDialog } = useDialog("log");
const { show: showInstanceInstallDialog } = useDialog(InstanceInstallDialog);
const { openModpack } = useService(ModpackServiceKey);
const { t } = useI18n();
const router = useRouter()

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

const loading = ref(false)
function onClickInstallFromModpack() {
  loading.value = true
  windowController
    .showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Modpack",
          extensions: ["zip", "mrpack"],
        },
      ],
    })
    .then(async (result) => {
      const file = result.canceled ? undefined : result.filePaths[0];
      if (!file) {
        return;
      }
      const modpack = await openModpack(file);
      const files = await waitModpackFiles(modpack);

      showInstanceInstallDialog({
        type: "updates",
        oldFiles: [],
        files: files,
        id: "",
      });
    }).finally(() => {
      loading.value = false
    });
}
</script>
<style scoped>
.compact {
  background: rgba(0, 0, 0, 0.5);
}
</style>
<style>
.home-actions .v-speed-dial__list {
  padding: 0.2rem;
  /* background-color: rgba(0, 0, 0); */
  /* border-radius: 0.6rem; */
}
</style>

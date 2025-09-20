<template>
  <div
    class="grid xl:gap-4 gap-1 home-actions"
    :style="{
      'grid-template-columns': `repeat(${
        instance && !instance.upstream ? 3 : 3
      }, minmax(0, 1fr))`,
    }"
  >
    <v-btn
      v-shared-tooltip="() => t('logsCrashes.title')"
      text
      icon
      :loading="isValidating"
      @click="showLogDialog()"
    >
      <v-icon> subtitles </v-icon>
    </v-btn>

    <v-btn
      v-shared-tooltip="() => t('instance.showInstance')"
      text
      icon
      :loading="isValidating"
      @click="showInstanceFolder"
    >
      <v-icon> folder </v-icon>
    </v-btn>

    <v-speed-dial
      :direction="'bottom'"
      :open-on-hover="true"
    >
      <template #activator>
        <v-btn
          v-shared-tooltip="() => t('baseSetting.title', 2)"
          text
          icon
          :loading="isValidating"
          to="/base-setting"
        >
          <v-icon> settings </v-icon>
        </v-btn>
      </template>
      <v-btn
        v-shared-tooltip.left="() => t('modpack.export')"
        text
        icon
        :loading="isValidating"
        to="/base-setting?target=modpack"
      >
        <v-icon> share </v-icon>
      </v-btn>
      <v-btn
        v-shared-tooltip.left="() => t('server.export')"
        icon
        :loading="isValidating"
        @click="showExportServer()"
      >
        <v-icon> ios_share </v-icon>
      </v-btn>
      <v-btn
        v-if="instance && !instance.upstream"
        v-shared-tooltip.left="() => t('instance.installModpack')"
        text
        icon
        :loading="isValidating || loading"
        @click="onClickInstallFromModpack()"
      >
        <v-icon> drive_folder_upload </v-icon>
      </v-btn>
    </v-speed-dial>
  </div>
</template>

<script lang="ts" setup>
import { useService } from "@/composables";
import { kInstance } from "@/composables/instance";
import { InstanceInstallDialog } from "@/composables/instanceUpdate";
import { kInstances } from "@/composables/instances";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import { injection } from "@/util/inject";
import {
  BaseServiceKey,
  ModpackServiceKey,
  waitModpackFiles,
} from "@xmcl/runtime-api";
import { useDialog } from "../composables/dialog";
import {
  AppExportServerDialogKey,
} from "../composables/instanceExport";

const { path, instance } = injection(kInstance);
const { isValidating } = injection(kInstances);
const { openDirectory } = useService(BaseServiceKey);
const { show: showLogDialog } = useDialog("log");
const { show: showExportServer } = useDialog(AppExportServerDialogKey);
const { show: showInstanceInstallDialog } = useDialog(InstanceInstallDialog);
const { openModpack } = useService(ModpackServiceKey);
const { t } = useI18n();

function showInstanceFolder() {
  openDirectory(path.value);
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
  padding: 0;
}
</style>

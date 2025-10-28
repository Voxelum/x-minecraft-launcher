<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    transition="dialog-bottom-transition"
    scrollable
    width="850"
    persistent
  >
    <v-card class="rounded-lg">
      <!-- Простой заголовок -->
      <v-card-title class="pa-5 d-flex align-center">
        <v-icon class="mr-3" size="28">mdi-import</v-icon>
        <span class="text-h6">{{ t("setting.migrateFromOther") }}</span>
        <v-spacer />
        <v-btn icon @click="cancel">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Индикатор шагов -->
      <div class="px-6 pt-4 pb-3">
        <div class="d-flex align-center">
          <div class="step-badge" :class="{ 'step-active': step === 1 }">
            <span class="font-weight-medium">1</span>
          </div>
          <div class="step-divider" :class="{ active: step === 2 }"></div>
          <div class="step-badge" :class="{ 'step-active': step === 2 }">
            <span class="font-weight-medium">2</span>
          </div>
        </div>
        <div class="d-flex justify-space-between mt-2">
          <span class="text-caption">{{ t("migrates.selectLauncher") }}</span>
          <span class="text-caption">{{ t("migrates.selectData") }}</span>
        </div>
      </div>

      <v-divider class="mb-4" />

      <!-- Контент -->
      <v-card-text class="pa-0" style="max-height: 60vh; overflow-y: auto">
        <v-stepper v-model="step" flat class="elevation-0 transparent">
          <v-stepper-items>
            <!-- Шаг 1 -->
            <v-stepper-content :step="1" class="pa-6">
              <StepSelect @select="onSelectType" />
            </v-stepper-content>

            <!-- Шаг 2 -->
            <v-stepper-content :step="2" class="pa-6">
              <template v-if="manifest">
                <!-- Папки игры -->
                <div v-if="activeFolders.length > 0" class="mb-5">
                  <div
                    class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center"
                  >
                    <v-icon small class="mr-2">mdi-folder</v-icon>
                    {{
                      t("instanceDiscover.gameFolder", {
                        count: activeFolders.length,
                      })
                    }}
                  </div>

                  <v-list class="py-0 transparent">
                    <v-list-item
                      v-for="folder in activeFolders"
                      :key="folder"
                      class="folder-item mb-2 rounded"
                      @click="onEnableFolder(folder)"
                    >
                      <v-list-item-avatar>
                        <v-icon>mdi-folder-outline</v-icon>
                      </v-list-item-avatar>
                      <v-list-item-content>
                        <v-list-item-title class="font-weight-medium">
                          {{ basename(folder) }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                          {{ folder }}
                        </v-list-item-subtitle>
                      </v-list-item-content>
                      <v-list-item-action>
                        <v-checkbox
                          :value="included.includes(folder)"
                          :input-value="included.includes(folder)"
                          readonly
                          @click.stop="onEnableFolder(folder)"
                        />
                      </v-list-item-action>
                    </v-list-item>
                  </v-list>
                </div>

                <!-- Экземпляры -->
                <div v-if="manifest.instances.length > 0">
                  <div
                    class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center"
                  >
                    <v-icon small class="mr-2">mdi-package-variant</v-icon>
                    {{
                      t("instanceDiscover.instanceFolder", {
                        count: manifest.instances.length,
                      })
                    }}
                  </div>

                  <v-list class="py-0 transparent">
                    <v-list-item
                      v-for="m of manifest.instances"
                      :key="m.path"
                      class="instance-item mb-2 rounded"
                    >
                      <InstanceItem
                        :value="included.includes(m.path)"
                        :runtime="m.options.runtime"
                        :name="m.options.name"
                        @select="onEnableFolder(m.path)"
                      />
                    </v-list-item>
                  </v-list>
                </div>

                <!-- Ошибка -->
                <v-alert v-if="error" type="error" text dense class="mt-4">
                  {{ errorText ?? error }}
                  <div v-if="error?.path" class="text-caption">
                    {{ error.path }}
                  </div>
                </v-alert>
              </template>
            </v-stepper-content>
          </v-stepper-items>
        </v-stepper>
      </v-card-text>

      <!-- Футер -->
      <template v-if="step === 2">
        <v-divider />
        <v-card-actions class="pa-5">
          <v-spacer />
          <v-btn text @click="cancel">
            {{ t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :disabled="included.length === 0"
            @click="onConfirm"
          >
            {{ t("migrates.imports") }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import InstanceItem from "@/components/InstanceItem.vue";
import StepperFooter from "@/components/StepperFooter.vue";
import StepSelect from "@/components/StepSelect.vue";
import { useDialog } from "@/composables/dialog";
import { useService } from "@/composables/service";
import { basename } from "@/util/basename";
import {
  InstanceIOServiceKey,
  InstanceType,
  ThirdPartyLauncherManifest,
} from "@xmcl/runtime-api";

const { t } = useI18n();
const { isShown, hide: cancel } = useDialog("migrate-wizard", () => {
  step.value = 1;
  error.value = undefined;
  manifest.value = undefined;
});

const step = ref(1);
const error = shallowRef(undefined as any);
const manifest = shallowRef(
  undefined as ThirdPartyLauncherManifest | undefined
);
const errorText = computed(() => t("errors.BadInstanceType", {}));
const included = shallowRef([] as string[]);

const { getGameDefaultPath, importLauncherData, parseLauncherData } =
  useService(InstanceIOServiceKey);

const onSelectType = async (type: InstanceType) => {
  const defaultPath =
    type === "modrinth"
      ? await getGameDefaultPath("modrinth")
      : type === "curseforge"
      ? await getGameDefaultPath("curseforge")
      : type === "vanilla"
      ? await getGameDefaultPath("vanilla")
      : undefined;

  const dir = await windowController.showOpenDialog({
    properties: ["openDirectory"],
    defaultPath,
  });

  if (dir.canceled) {
    return;
  }

  const instancePath = dir.filePaths[0];
  const man = await parseLauncherData(instancePath, type).catch((e) => {
    error.value = e;
    return undefined;
  });

  manifest.value = man;

  const newIncluded = [] as string[];

  if (man) {
    newIncluded.push(...man.instances.map((i) => i.path));

    if (man.folder.assets) {
      newIncluded.push(man.folder.assets);
    }
    if (man.folder.libraries) {
      newIncluded.push(man.folder.libraries);
    }
    if (man.folder.versions) {
      newIncluded.push(man.folder.versions);
    }
    if (man.folder.jre) {
      newIncluded.push(man.folder.jre);
    }
  }

  included.value = newIncluded;

  if (!error.value) {
    nextTick().then(() => {
      step.value += 1;
    });
  }
};

const activeFolders = computed(() =>
  manifest.value ? Object.values(manifest.value.folder).filter((v) => !!v) : []
);

function onConfirm() {
  if (!manifest.value) {
    return;
  }

  const man = manifest.value;
  const instances = man.instances.filter((i) =>
    included.value.includes(i.path)
  );
  const newMan: ThirdPartyLauncherManifest = {
    instances,
    folder: {
      assets: included.value.includes(man.folder.assets)
        ? man.folder.assets
        : "",
      versions: included.value.includes(man.folder.versions)
        ? man.folder.versions
        : "",
      libraries: included.value.includes(man.folder.libraries)
        ? man.folder.libraries
        : "",
      jre:
        man.folder.jre && included.value.includes(man.folder.jre)
          ? man.folder.jre
          : "",
    },
  };

  cancel();
  importLauncherData(newMan);
}

function onEnableFolder(folder: string) {
  if (included.value.includes(folder)) {
    included.value = included.value.filter((i) => i !== folder);
  } else {
    included.value.push(folder);
  }
}
</script>

<style scoped>
.step-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #757575;
  transition: all 0.2s;
}

.step-badge.step-active {
  background: var(--v-primary-base);
  color: white;
}

.step-divider {
  flex: 1;
  height: 2px;
  background: #e0e0e0;
  margin: 0 16px;
  transition: all 0.2s;
}

.step-divider.active {
  background: var(--v-primary-base);
}

.folder-item,
.instance-item {
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
  cursor: pointer;
}

.folder-item:hover,
.instance-item:hover {
  border-color: var(--v-primary-base);
  background: rgba(0, 0, 0, 0.02);
}

.v-stepper {
  box-shadow: none !important;
}

.v-stepper__content {
  padding: 0 !important;
}
</style>

<template>
  <div
    class="flex flex-col flex-1 flex-grow-0 gap-3 max-w-full"
    :class="{
      'backdrop-filter': !isInFocusMode,
      'backdrop-blur-sm': !isInFocusMode,
    }"
  >
    <div
      class="flex w-full align-center max-h-20 gap-3 flex-grow-0 flex-1 items-baseline"
    >
      <span
        class="display-2 rounded-lg py-4 text-shadow text-shadow-lg"
        :class="{ 'display-1': name && name.length > 30 }"
      >{{ name || `Minecraft ${version.minecraft}` }}</span>

      <div class="flex-grow" />
      <HomeHeaderInstallStatus
        v-if="status === 1 || status === 3"
        :name="taskName"
        :total="total"
        :progress="progress"
      />
    </div>
    <div
      class="flex align-end gap-3 flex-grow-0 flex-1 mt-4 "
    >
      <div
        class="flex flex-row items-start gap-3 flex-wrap flex-grow-0"
      >
        <v-chip
          label
          class="pointer"
          :color="!localVersion.id ? 'warning' : 'primary'"
          :input-value="false"
          @click="onShowLocalVersion"
        >
          <v-avatar left>
            <v-icon>
              folder
            </v-icon>
          </v-avatar>
          {{ t('version.name', 2) }}: {{ !localVersion.id ? t('version.notInstalled') : localVersion.id }}
        </v-chip>
        <HomeHeaderMinecraftLabel
          :minecraft="version.minecraft"
        />
        <HomeHeaderForgeLabel
          :minecraft="version.minecraft"
          :forge="version.forge"
        />
        <HomeHeaderFabricLabel
          :fabric-loader="version.fabricLoader"
          :minecraft="version.minecraft"
        />
        <HomeHeaderQuiltLabel
          :quilt-loader="version.quiltLoader"
          :minecraft="version.minecraft"
        />
        <v-chip
          v-if="version.optifine"
          label
          outlined
        >
          <v-avatar left>
            <img
              :src="'image://builtin/optifine'"
            >
          </v-avatar>
          <div>
            Optifine
            {{ version.optifine }}
          </div>
        </v-chip>
      </div>
      <div class="flex-grow" />

      <div
        v-if="!isInFocusMode"
        class="flex align-end gap-3 flex-1 flex-grow-0"
      >
        <v-tooltip
          :close-delay="0"
          top
          transition="scroll-y-reverse-transition"
        >
          <template #activator="{ on }">
            <v-btn
              text
              icon
              :loading="refreshing"
              v-on="on"
              @click="showExport"
            >
              <v-icon>
                share
              </v-icon>
            </v-btn>
          </template>
          {{ t('modpack.export') }}
        </v-tooltip>

        <v-tooltip
          top
          transition="scroll-y-reverse-transition"
        >
          <template #activator="{ on }">
            <v-btn
              text
              icon
              v-on="on"
              @click="showLogDialog"
            >
              <v-icon>
                subtitles
              </v-icon>
            </v-btn>
          </template>
          {{ t("logsCrashes.title") }}
        </v-tooltip>

        <v-tooltip
          top
          transition="scroll-y-reverse-transition"
        >
          <template #activator="{ on }">
            <v-btn
              text
              icon
              v-on="on"
              @click="showInstanceFolder"
            >
              <v-icon>
                folder
              </v-icon>
            </v-btn>
          </template>
          {{ t("instance.showInstance") }}
        </v-tooltip>

        <v-tooltip
          top
          transition="scroll-y-reverse-transition"
        >
          <template #activator="{ on }">
            <v-btn
              text
              icon
              to="/base-setting"
              v-on="on"
            >
              <v-icon>
                settings
              </v-icon>
            </v-btn>
          </template>
          {{ t('baseSetting.title', 2) }}
        </v-tooltip>

        <HomeLaunchButton
          class="ml-4"
          :issue="issue"
          :status="status"
          @pause="pause"
          @resume="resume"
        />
      </div>
    </div>
  </div>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kInstanceContext } from '@/composables/instanceContext'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { BaseServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { AppExportDialogKey } from '../composables/instanceExport'
import HomeHeaderFabricLabel from './HomeHeaderFabricLabel.vue'
import HomeHeaderForgeLabel from './HomeHeaderForgeLabel.vue'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeHeaderMinecraftLabel from './HomeHeaderMinecraftLabel.vue'
import HomeHeaderQuiltLabel from './HomeHeaderQuiltLabel.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'

const { issue, task, path, refreshing, name, version, localVersion } = injection(kInstanceContext)
const isInFocusMode = useInFocusMode()
const { total, progress, name: taskName, pause, resume, status } = task
const { openDirectory } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')
const { show: showExport } = useDialog(AppExportDialogKey)
const { t } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const onShowLocalVersion = () => {
  if (localVersion.value.id) {
    showVersionDirectory(localVersion.value.id)
  }
}

function showInstanceFolder() {
  openDirectory(path.value)
}

</script>

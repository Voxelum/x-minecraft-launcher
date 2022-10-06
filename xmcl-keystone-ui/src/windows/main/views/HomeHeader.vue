<template>
  <div
    class="flex flex-col flex-1 flex-grow-0 gap-3 max-w-full backdrop-filter backdrop-blur-sm"
  >
    <div
      class="flex w-full align-center max-h-20 gap-3 flex-grow-0 flex-1 items-baseline"
    >
      <span
        class="display-2 rounded-lg py-4 text-shadow text-shadow-lg"
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
          {{ tc('version.name', 2) }}: {{ !localVersion.id ? t('version.notInstalled') : localVersion.id }}
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
      </div>
      <div class="flex-grow" />

      <div class="flex align-end gap-3 flex-1 flex-grow-0">
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
          {{ tc('setting.name', 2) }}
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
import { AssetIndexIssueKey, AssetsIssueKey, BaseServiceKey, InstallProfileIssueKey, isIssue, LibrariesIssueKey, VersionIssueKey, VersionJarIssueKey, VersionJsonIssueKey, VersionServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useInstance, useInstanceVersion } from '../composables/instance'
import { AppExportDialogKey } from '../composables/instanceExport'
import { useTask } from '../composables/task'
import HomeHeaderFabricLabel from './HomeHeaderFabricLabel.vue'
import HomeHeaderForgeLabel from './HomeHeaderForgeLabel.vue'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeHeaderMinecraftLabel from './HomeHeaderMinecraftLabel.vue'
import HomeHeaderQuiltLabel from './HomeHeaderQuiltLabel.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import { useI18n, useIssues, useService } from '/@/composables'

const { issues } = useIssues()
const issue = computed(() => {
  for (const i of issues.value) {
    if (isIssue(AssetsIssueKey, i)) {
      return i
    }
    if (isIssue(LibrariesIssueKey, i)) {
      return i
    }
    if (isIssue(AssetIndexIssueKey, i)) {
      return i
    }
    if (isIssue(VersionIssueKey, i)) {
      return i
    }
    if (isIssue(VersionJsonIssueKey, i)) {
      return i
    }
    if (isIssue(VersionJarIssueKey, i)) {
      return i
    }
    if (isIssue(InstallProfileIssueKey, i)) {
      return i
    }
  }
  return undefined
})

const { path, instance, refreshing } = useInstance()
const name = computed(() => instance.value.name)
const version = computed(() => instance.value.runtime)
const { localVersion } = useInstanceVersion()
const { openDirectory } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')
const { show: showExport } = useDialog(AppExportDialogKey)
const { t, tc } = useI18n()
const { showVersionDirectory } = useService(VersionServiceKey)

const onShowLocalVersion = () => {
  if (localVersion.value.id) {
    showVersionDirectory(localVersion.value.id)
  }
}

const { total, progress, name: taskName, pause, resume, status } = useTask((i) => {
  const p = i.param as any
  if (i.path === 'installVersion' && p?.id === version.value.minecraft) {
    return true
  }
  if (i.path === 'installVersion.jar' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft)) {
    return true
  }
  if (i.path === 'installLibraries' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft)) {
    return true
  }
  if (i.path === 'installAssets' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft)) {
    return true
  }
  if (i.path === 'installForge' && p?.id === version.value.forge) {
    return true
  }
  if (i.path === 'installOptifine' && p?.id === version.value.optifine) {
    return true
  }
  if (i.path === 'installByProfile' && p?.id === localVersion.value.id) {
    return true
  }
  if (i.path === 'installFabric' && p?.id === version.value.minecraft) {
    return true
  }
  if (i.path === 'updateInstance' && p.instance === path.value) {
    // installing this instance
    return true
  }
  return false
})

function showInstanceFolder() {
  openDirectory(path.value)
}

</script>

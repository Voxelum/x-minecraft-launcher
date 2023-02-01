<template>
  <div class="">
    <v-subheader>
      {{ t('modrinth.featuredVersions') }}
    </v-subheader>
    <ErrorView
      :error="error"
      @refresh="refresh"
    />
    <v-list color="transparent">
      <v-list-item
        v-for="version of featured"
        :key="version.id"
        @click="onInstall(version)"
      >
        <v-list-item-avatar>
          <v-progress-circular
            v-if="tasks[version.id]"
            :size="24"
            :width="3"
            :value="tasks[version.id].progress / tasks[version.id].total * 100"
          />
          <v-icon
            v-else
            class="material-icons-outlined"
          >
            {{ isDownloaded(version) ? 'add' : 'file_download' }}
          </v-icon>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title v-text="version.name" />
          <v-list-item-subtitle>
            <div>
              {{ version.loaders.join(' ') }}
              {{ version.game_versions.length === 1 ? version.game_versions[0] : version.game_versions[0] + '-' + version.game_versions[version.game_versions.length - 1] }}
            </div>
            <span
              :style="{ color: getColorCode(getColorForReleaseType(version.version_type)) }"
            >
              •
              {{ t(`versionType.${version.version_type}`) }}
            </span>
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { kModrinthInstall } from '@/composables/modrinthInstall'
import { kModrinthVersionsStatus, useModrinthVersions } from '@/composables/modrinthVersions'
import { useVuetifyColor } from '@/composables/vuetify'
import { getColorForReleaseType } from '@/util/color'
import { injection } from '@/util/inject'
import { Project } from '@xmcl/modrinth'

const props = defineProps<{
  project: Project
  installTo: string
}>()

const { t } = useI18n()

const { getColorCode } = useVuetifyColor()
const { onInstall } = injection(kModrinthInstall)

const { versions: featured, refreshing, error, refresh } = useModrinthVersions(computed(() => props.project.id), true)
const { tasks, isDownloaded } = injection(kModrinthVersionsStatus)
</script>

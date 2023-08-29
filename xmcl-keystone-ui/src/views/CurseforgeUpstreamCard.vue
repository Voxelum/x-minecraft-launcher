<template>
  <v-card
    outlined
    class="relative flex flex-shrink flex-grow-0 flex-col"
  >
    <v-alert
      v-if="error"
      class="mt-4"
      dense
      outlined
      type="error"
    >
      {{ error }}
    </v-alert>
    <v-list>
      <v-subheader>
        {{ t('curseforgeCard.currentFile') }}
      </v-subheader>
      <v-list-item>
        <v-list-item-content v-if="currentFileResource">
          <v-list-item-title>
            {{ currentFileResource.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ getExpectedSize(currentFileResource.size) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-content v-else>
          <v-alert
            class="mb-0"
            type="warning"
          >
            {{ t('upstream.missingModpackMetadata') }}
          </v-alert>
        </v-list-item-content>
      </v-list-item>
      <v-subheader
        v-if="fileIndex"
      >
        {{ t('curseforgeCard.projectLastFile') }}
      </v-subheader>
      <CurseforgeProjectFileItem
        v-if="fileIndex"
        :id="fileIndex.fileId"
        :upstream-file-id="upstream ? upstream.fileId : undefined"
        :mod-id="modId"
        :versions="[fileIndex.gameVersion]"
        :name="fileIndex.filename"
        :release-type="fileIndex.releaseType"
        @install="onUpdate"
      />
    </v-list>
    <v-subheader
      v-if="changelog"
    >
      {{ t('FeedTheBeastProject.changelog') }}
    </v-subheader>
    <p
      v-if="changelog"
      class="visible-scroll light:bg-[rgba(0,0,0,0.07)] light:hover:(bg-[rgba(0,0,0,0.05)]) dark:hover:(bg-[rgba(0,0,0,0.3)]) mx-4 mb-4 max-h-[45vh] select-text overflow-auto rounded-md p-4 dark:bg-[rgba(0,0,0,0.4)]"
      v-html="changelog"
    />
  </v-card>
</template>
<script lang="ts" setup>
import { useRefreshable } from '@/composables'
import { useCurseforgeChangelog } from '@/composables/curseforgeChangelog'
import { kCurseforgeInstall } from '@/composables/curseforgeInstall'
import { kLatestCurseforgeResource } from '@/composables/curseforgeResource'
import { UpdateStatus, useCurseforgeInstanceUpdate } from '@/composables/instanceUpdate'
import { injection } from '@/util/inject'
import { InstanceData } from '@xmcl/runtime-api'
import { getExpectedSize } from '../util/size'
import CurseforgeProjectFileItem from './CurseforgeProjectFileItem.vue'

const props = defineProps<{
  upstream: Required<InstanceData>['upstream'] & { type: 'curseforge-modpack' }
  modId: number
}>()

const buttonTexts = computed(() => ({
  [UpdateStatus.Unchecked]: t('checkUpdate.name'),
  [UpdateStatus.UpdateAvaiable]: t('download'),
  [UpdateStatus.UpdateReady]: t('install'),
  [UpdateStatus.NoUpdate]: t('launcherUpdate.noUpdateAvailable'),
}))

// Latest resource
const { resource, fileIndex } = injection(kLatestCurseforgeResource)

// Changelog
const { changelog } = useCurseforgeChangelog(computed(() => props.modId), computed(() => fileIndex.value?.fileId || undefined))
const { install } = injection(kCurseforgeInstall)
const { error, refresh: onUpdate } = useRefreshable(async () => { if (fileIndex.value) { await install(fileIndex.value) } })
const { status, currentFileResource } = useCurseforgeInstanceUpdate(props, resource, fileIndex)

const { t } = useI18n()
</script>

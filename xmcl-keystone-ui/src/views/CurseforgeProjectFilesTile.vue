<template>
  <v-list-item>
    <v-list-item-avatar>
      <v-chip
        label
        :color="getColor(source.releaseType)"
      >
        {{ releases[source.releaseType] }}
      </v-chip>
    </v-list-item-avatar>
    <v-list-item-content class="flex-grow">
      <v-list-item-title :title="source.displayName">
        {{ source.displayName }}
      </v-list-item-title>
      <v-list-item-subtitle class>
        <div class="text-gray-400">
          {{ getLocalDateString(source.fileDate) }}
        </div>
      </v-list-item-subtitle>
    </v-list-item-content>
    <div class="flex justify-end mr-2 gap-2 flex-grow-0 flex-shrink">
      <v-chip
        v-if="source.gameVersions[0]"
        small
        label
      >
        {{ source.gameVersions[0] }}
      </v-chip>
      <v-chip
        v-if="source.gameVersions[1]"
        small
        label
      >
        {{ source.gameVersions[1] }}
      </v-chip>
      <v-chip
        small
        label
      >
        {{ (source.fileLength / 1024 / 1024).toFixed(2) }} MB
      </v-chip>
    </div>
    <v-list-item-action>
      <v-btn
        text
        icon
        :loading="installingVersion || isDownloading"
        @click="onClick(source)"
        @mouseenter="onMouseEnter($event, hasDownloaded)"
        @mouseleave="onMouseLeave($event, hasDownloaded)"
      >
        <template #loader>
          <v-progress-circular
            :indeterminate="installingVersion && !name"
            :value="percentage"
            :size="24"
            :width="2"
          />
        </template>
        <template #default>
          <v-icon>
            {{ hasDownloaded ? 'add' : 'download' }}
          </v-icon>
        </template>
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
import { File } from '@xmcl/curseforge'

import { useTask } from '@/composables/task'
import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'
import { useServiceBusy } from '@/composables'
import { CurseForgeServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  source: File
  isDownloaded(file: File): boolean
  install(file: File): Promise<void>
  onMouseEnter(e: MouseEvent, downloaded: boolean): void
  onMouseLeave(e: MouseEvent, downloaded: boolean): void
}>()

const { name, progress, total } = useTask(t => t.path === 'installCurseforgeFile' && t.param.fileId === props.source.id)
const isDownloading = computed(() => !!name.value)
const percentage = computed(() => name.value ? (progress.value / total.value * 100) : -1)
const hasDownloaded = computed(() => props.isDownloaded(props.source))
const installingVersion = useServiceBusy(CurseForgeServiceKey, 'installFile', computed(() => props.source.id.toString()))
const releases = ['', 'R', 'A', 'B']
const getColor = getColorForReleaseType
const onClick = (file: File) => {
  props.install(file)
}
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
.v-window {
  overflow: auto;
}
.v-window__container {
  overflow: auto;
}
</style>

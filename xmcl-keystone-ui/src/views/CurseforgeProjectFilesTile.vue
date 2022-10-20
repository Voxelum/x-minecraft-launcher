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
    <v-list-item-content>
      <v-list-item-title>{{ source.displayName }}</v-list-item-title>
      <v-list-item-subtitle class>
        <div class="text-gray-400">
          {{ getLocalDateString(source.fileDate) }}
        </div>
      </v-list-item-subtitle>
    </v-list-item-content>
    <div class="flex justify-end mr-2 gap-2">
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
    <v-list-item-action v-if="!modpack">
      <v-btn
        text
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="install(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? t('curseforge.installed') : t('curseforge.install') }}
      </v-btn>
    </v-list-item-action>
    <v-list-item-action v-else>
      <v-btn
        text
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="download(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? t('curseforge.downloaded') : t('curseforge.downloadOnly') }}
      </v-btn>
    </v-list-item-action>
    <v-list-item-action v-if="modpack">
      <v-btn
        text
        :loading="getFileStatus(source) === 'downloading'"
        @click="install(source)"
      >
        {{ t('curseforge.install') }}
      </v-btn>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
import { File } from '@xmcl/curseforge'

import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'

withDefaults(
  defineProps<{
    source: File
    getFileStatus(file: File) : string
    install(file: File): Promise<void>
    download(file: File): Promise<void>
    modpack: boolean
  }>(),
  { download: () => Promise.resolve() },
)

const { t } = useI18n()
const releases = ['', 'R', 'A', 'B']
const getColor = getColorForReleaseType
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

<template>
  <v-list-tile avatar>
    <v-list-tile-avatar>
      <v-chip
        label
        :color="getColor(source.releaseType)"
      >
        {{ releases[source.releaseType] }}
      </v-chip>
    </v-list-tile-avatar>
    <v-list-tile-content>
      <v-list-tile-title>{{ source.displayName }}</v-list-tile-title>
      <v-list-tile-sub-title class>
        <div class="text-gray-400">
          {{ new Date(source.fileDate).toLocaleString() }}
        </div>
      </v-list-tile-sub-title>
    </v-list-tile-content>
    <div class="flex justify-end mr-2">
      <v-chip
        v-if="source.gameVersion[0]"
        small
        label
      >
        {{ source.gameVersion[0] }}
      </v-chip>
      <v-chip
        v-if="source.gameVersion[1]"
        small
        label
      >
        {{ source.gameVersion[1] }}
      </v-chip>
      <v-chip
        small
        label
      >
        {{ (source.fileLength / 1024 / 1024).toFixed(2) }} MB
      </v-chip>
    </div>
    <v-list-tile-action v-if="!modpack">
      <v-btn
        flat
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="install(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? $t('curseforge.installed') : $t('curseforge.install') }}
      </v-btn>
    </v-list-tile-action>
    <v-list-tile-action v-else>
      <v-btn
        flat
        :loading="getFileStatus(source) === 'downloading'"
        :disabled="getFileStatus(source) === 'downloaded'"
        @click="download(source)"
      >
        {{ getFileStatus(source) === 'downloaded' ? $t('curseforge.downloaded') : $t('curseforge.downloadOnly') }}
      </v-btn>
    </v-list-tile-action>
    <v-list-tile-action v-if="modpack">
      <v-btn
        flat
        :loading="getFileStatus(source) === 'downloading'"
        @click="install(source)"
      >
        {{ $t('curseforge.install') }}
      </v-btn>
    </v-list-tile-action>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import {
  required,
  withDefault,
} from '/@/util/props'
import { File } from '@xmcl/curseforge'

export default defineComponent({
  props: {
    source: required<File>(Object),
    getFileStatus: required<(file: File) => string>(Function),
    install: required<(file: File) => Promise<void>>(Function),
    download: withDefault<(file: File) => Promise<void>>(Function, () => () => Promise.resolve()),
    modpack: required(Boolean),
  },
  setup(props) {
    const releases = ['', 'R', 'A', 'B']
    function getColor(type: number) {
      switch (type) {
        case 1: return 'primary'
        case 2: return 'red'
        case 3: return 'orange'
        default:
          return ''
      }
    }
    return {
      getColor,
      releases,
    }
  },
})
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

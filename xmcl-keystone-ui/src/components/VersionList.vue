<template>
  <div class="flex h-full flex-col overflow-auto">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />
    <v-list-item class="flex-grow-0 flex-shrink flex-1 flex justify-end">
      <slot name="header" />
    </v-list-item>
    <v-divider />
    <div
      v-if="refreshing && versions.length === 0"
      class="flex flex-col gap-2 pt-2"
    >
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
      <v-skeleton-loader
        type="list-item-avatar-two-line"
      />
    </div>
    <v-list
      v-else-if="versions.length !== 0"
      class="h-full flex flex-col overflow-auto flex-grow"
      style="background-color: transparent;"
    >
      <v-list-item
        v-if="canDisable"
        ripple
        class="flex-grow-0 flex-1 justify-start"
        @click="emit('disable')"
      >
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        {{ disableText }}
      </v-list-item>
      <virtual-list
        class="h-full overflow-y-auto"
        :data-sources="versions"
        :data-key="'name'"
        :data-component="VersionListTile"
        :keep="16"
        :extra-props="{ select: onSelect, install, show: onShow }"
      />
    </v-list>
    <Hint
      v-else
      v-ripple
      class="flex-grow"
      icon="refresh"
      :text="emptyText"
    />
  </div>
</template>

<script lang=ts setup>
import { VersionItem } from '../composables/versionList'
import VersionListTile from './VersionListTile.vue'
import Hint from '@/components/Hint.vue'

defineProps<{
  canDisable?: boolean
  disableText?: string
  emptyText?: string
  refreshing: boolean
  versions: VersionItem[]
  install(v: object): Promise<any>
}>()

const onSelect = (v: VersionItem) => emit('select', v.name)
const onInstall = (v: VersionItem) => emit('install', v.instance)
const onShow = (v: VersionItem) => emit('show', v.folder)
const emit = defineEmits(['disable', 'refresh', 'select', 'install', 'show'])

</script>

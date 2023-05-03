<template>
  <div class="relative w-full">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="refreshing"
      height="3"
      :indeterminate="true"
    />

    <v-list
      v-if="!refreshing || files.length !== 0"
      color="transparent"
    >
      <ErrorView
        :error="error"
        @refresh="refresh"
      />
      <CurseforgeProjectFileItem
        v-for="file in files"
        :id="file.id"
        :key="file.id"
        :mod-id="modId"
        :name="file.fileName"
        :loader="file.gameVersions.find(v => !Number.isInteger(Number(v[0])))"
        :versions="file.gameVersions.filter(v => Number.isInteger(Number(v[0])))"
        :size="file.fileLength"
        :date="file.fileDate"
        :release-type="file.releaseType"
        @install="emit('install', file)"
      />
    </v-list>
    <v-skeleton-loader
      v-else
      class="children:bg-transparent"
      type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
    />
  </div>
</template>
<script setup lang="ts">
import ErrorView from '@/components/ErrorView.vue'
import { useCurseforgeProjectFiles } from '@/composables/curseforge'
import { kCurseforgeInstall, useCurseforgeInstall } from '@/composables/curseforgeInstall'
import { Mod } from '@xmcl/curseforge'
import CurseforgeProjectFileItem from './CurseforgeProjectFileItem.vue'

const props = defineProps<{
  mod: Mod
  loader: string
  minecraft: string
}>()

const emit = defineEmits(['install'])

const modId = computed(() => props.mod.id)

const { files, refresh, refreshing, error } = useCurseforgeProjectFiles(modId,
  computed(() => props.minecraft),
  computed(() => props.loader === 'fabric' ? 4 : props.loader === 'forge' ? 1 : 0),
)
provide(kCurseforgeInstall, useCurseforgeInstall(modId, files, ref(undefined), ref('mc-mods'), ref(undefined)))

</script>

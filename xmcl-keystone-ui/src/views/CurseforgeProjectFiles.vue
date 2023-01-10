<template>
  <div
    class="h-full flex overflow-auto"
  >
    <div
      class="flex flex-col h-full overflow-auto"
    >
      <div class="flex gap-5 mx-5 mt-3">
        <v-select
          v-model="modLoader"
          clearable
          hide-details
          flat
          solo
          dense
          :items="modLoaders"
          :label="t('curseforge.file.modLoader')"
        />
        <v-select
          v-model="gameVersion"
          clearable
          hide-details
          flat
          solo
          dense
          :items="gameVersions"
          :label="t('curseforge.file.gameVersion')"
        />
        <v-select
          v-model="releaseType"
          clearable
          hide-details
          flat
          solo
          dense
          :items="releaseTypes"
          :label="t('curseforge.file.releaseType')"
        />
      </div>
      <div
        v-if="loading"
        class="v-list max-h-[100vh] h-full overflow-auto"
      >
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
        <v-skeleton-loader type="list-item-avatar-three-line" />
      </div>
      <ErrorView
        :error="error"
        @refresh="refresh"
      />
      <VirtualList
        v-if="!error && !loading"
        class="v-list max-h-[100vh] h-full overflow-auto transition-none"
        :data-component="Tile"
        :data-key="'id'"
        :data-sources="filteredFiles"
        :estimate-size="56"
        :extra-props="{ isDownloaded, install: install, onMouseEnter: tooltip.onEnter, onMouseLeave: tooltip.onLeave }"
      />
      <SharedTooltip />
    </div>
  </div>
</template>

<script lang=ts setup>
import { useCurseforgeInstall } from '@/composables/curseforgeInstall'
import { kSharedTooltip, useSharedTooltip } from '@/composables/sharedTooltip'
import { ProjectType } from '@xmcl/runtime-api'
import VirtualList from 'vue-virtual-scroll-list'
import { useCurseforgeProjectFiles } from '../composables/curseforge'
import Tile from './CurseforgeProjectFilesTile.vue'
import SharedTooltip from '../components/SharedTooltip.vue'
import ErrorView from '@/components/ErrorView.vue'

const props = defineProps<{
  project: number
  type: ProjectType
  from?: string
}>()

const { files, refreshing: loading, refresh, error } = useCurseforgeProjectFiles(props.project)

const tooltip = useSharedTooltip<boolean>((v) => {
  return v ? t('curseforge.install') : t('curseforge.downloadOnly')
})
provide(kSharedTooltip, tooltip)

const { install, isDownloaded } = useCurseforgeInstall(files, computed(() => props.from), props.type)

const { t } = useI18n()
const releaseMappper = computed(() => [
  { text: t('curseforge.fileReleaseType.release'), value: 1 },
  { text: t('curseforge.fileReleaseType.alpha'), value: 2 },
  { text: t('curseforge.fileReleaseType.beta'), value: 3 },
])
const sortBy = ref('date')
const sortBys = computed(() => [
  { text: t('curseforge.file.sortByName'), value: 'name' },
  { text: t('curseforge.file.sortByDate'), value: 'date' },
])
const releaseType = ref(undefined as undefined | number)
const releaseTypes = computed(() => {
  const set = new Set<number>()
  for (const file of files.value) {
    set.add(file.releaseType)
  }
  return [...set].map(i => releaseMappper.value[i - 1]).filter((v) => !!v)
})
const modLoader = ref('')
const modLoaders = computed(() => {
  const set = new Set<string>()
  for (const file of files.value) {
    for (const ver of file.gameVersions) {
      if (ver === 'Forge' || ver === 'Fabric' || ver === 'Quilt') {
        set.add(ver)
        if (set.size >= 2) {
          break
        }
      }
    }
  }
  return [...set]
})
const gameVersion = ref('')
const gameVersions = computed(() => {
  const set = new Set<string>()
  for (const file of files.value) {
    for (const ver of file.gameVersions) {
      if (ver !== 'Forge' && ver !== 'Fabric' && ver !== 'Quilt') {
        set.add(ver)
      }
    }
  }
  return [...set]
})
const filteredFiles = computed(() => {
  const gameVersionVal = gameVersion.value
  const releaseTypeVal = releaseType.value
  const modLoaderVal = modLoader.value
  return files.value.filter(v =>
    (!releaseTypeVal || (v.releaseType === releaseTypeVal)) &&
        (!gameVersionVal || v.gameVersions.indexOf(gameVersionVal) !== -1) &&
        (!modLoaderVal || v.gameVersions.indexOf(modLoaderVal) !== -1),
  )
})

</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>

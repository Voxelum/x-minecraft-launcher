<template>
  <div
    class="h-full flex overflow-auto"
  >
    <div
      class="flex flex-col h-full overflow-auto"
    >
      <div class="flex flex-shrink flex-grow-0 gap-5 mx-5 mt-3">
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
          :items="gameVersions || []"
          :label="t('curseforge.file.gameVersion')"
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
      <v-list
        v-if="!error && !loading"
        class="h-full overflow-auto visible-scroll"
      >
        <CurseforgeProjectFileItem
          v-for="file in files"
          :id="file.id"
          :key="file.id"
          :mod-id="project"
          :name="file.fileName"
          :upstream-file-id="upstream ? upstream.fileId : undefined"
          :loader="file.gameVersions.find(v => !Number.isInteger(Number(v[0])))"
          :versions="file.gameVersions.filter(v => Number.isInteger(Number(v[0])))"
          :size="file.fileLength"
          :date="file.fileDate"
          :release-type="file.releaseType"
          @install="install(file)"
        />
      </v-list>
      <v-pagination
        v-if="!error && !loading"
        v-model="page"
        color="success"
        class="mb-3"
        :disabled="loading"
        :length="pages"
        :total-visible="12"
      />
    </div>
  </div>
</template>

<script lang=ts setup>
import { kCurseforgeInstall } from '@/composables/curseforgeInstall'
import { ProjectType } from '@xmcl/runtime-api'
import { useCurseforgeProjectFiles } from '../composables/curseforge'
import ErrorView from '@/components/ErrorView.vue'
import CurseforgeProjectFileItem from './CurseforgeProjectFileItem.vue'
import { injection } from '@/util/inject'

const props = defineProps<{
  project: number
  type: ProjectType
  from?: string
  upstream?: { modId: number; fileId: number }
  gameVersions?: string[]
  modLoaders?: string[]
}>()

const { files, refreshing: loading, refresh, error, pageSize, totalCount, index, gameVersion, modLoaderType } = useCurseforgeProjectFiles(computed(() => props.project))

const page = computed({
  set(page: number) { index.value = ((page - 1) * pageSize.value) },
  get() { return index.value / pageSize.value + 1 },
})
const pages = computed(() => Math.ceil(totalCount.value / pageSize.value))

watch([page, gameVersion, modLoaderType], () => refresh())

const { install } = injection(kCurseforgeInstall)

const { t } = useI18n()
const modLoader = computed({
  get() {
    if (!modLoaderType.value) return undefined
    return all[modLoaderType.value]
  },
  set(v: string | undefined) {
    if (!v) {
      modLoaderType.value = undefined
    } else {
      modLoaderType.value = Math.max(all.indexOf(v), 0)
    }
  },
})
const all = [
  'Any',
  'Forge',
  'Cauldron',
  'LiteLoader',
  'Fabric',
  'Quilt',
]

</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>

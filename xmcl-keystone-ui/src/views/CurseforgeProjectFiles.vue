<template>
  <div
    class="flex h-full overflow-auto"
  >
    <div
      class="flex h-full flex-col overflow-auto"
    >
      <div class="mx-5 mt-3 flex flex-shrink flex-grow-0 gap-5">
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
        class="v-list h-full max-h-[100vh] overflow-auto"
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
        class="visible-scroll h-full overflow-auto"
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
import { Ref } from 'vue'
import { FileModLoaderType } from '@xmcl/curseforge'

const props = defineProps<{
  project: number
  type: ProjectType
  from?: string
  upstream?: { modId: number; fileId: number }
  gameVersions?: string[]
  modLoaders?: string[]
}>()

const gameVersion: Ref<string | undefined> = ref(undefined)
const modLoaderType: Ref<FileModLoaderType | undefined> = ref(undefined)
const { files, refreshing: loading, refresh, error, pageSize, totalCount, index } = useCurseforgeProjectFiles(computed(() => props.project), gameVersion, modLoaderType)

const page = computed({
  set(page: number) { index.value = ((page - 1) * pageSize.value) },
  get() { return index.value / pageSize.value + 1 },
})
const pages = computed(() => Math.ceil(totalCount.value / pageSize.value))

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

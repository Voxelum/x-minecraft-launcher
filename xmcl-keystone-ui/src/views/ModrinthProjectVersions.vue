<template>
  <v-card class="flex flex-col">
    <div class="flex gap-5 mx-5 mt-3 flex-shrink flex-grow-0">
      <v-select
        v-model="gameVersion"
        clearable
        hide-details
        flat
        solo
        dense
        :items="gameVersions"
        :label="t('modrinth.gameVersions.name')"
      />
      <v-select
        v-model="modLoader"
        clearable
        hide-details
        flat
        solo
        dense
        :items="modLoaders"
        :label="t('modrinth.modLoaders.name')"
      />
      <v-select
        v-model="releaseType"
        clearable
        hide-details
        flat
        solo
        dense
        :items="releaseTypes"
        :label="t('versionType.name')"
      />
    </div>
    <v-skeleton-loader
      v-if="refreshing"
      type="table-thead, table-tbody"
    />
    <ErrorView
      v-else-if="versionsError"
      :error="versionsError"
      @refresh="refresh"
    />
    <div
      v-else
      style="border-spacing: 0.75em"
    >
      <div
        class="text-gray-400 font-bold text-lg align-middle grid grid-cols-13 my-4"
      >
        <div
          role="presentation col-span-1"
        />
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.version') }}
        </div>
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.support') }}
        </div>
        <div class="col-span-4 text-left ">
          {{ t('modrinth.headers.status') }}
        </div>
      </div>
      <v-list
        color="transparent"
        class="visible-scroll max-h-full overflow-auto transition-none"
      >
        <ModrinthProjectVersionsTile
          v-for="i of visibleVersions"
          :key="i.id"
          :source="i"
          @install="onInstall"
        />
      </v-list>
      <v-pagination
        v-model="page"
        color="success"
        class="mb-3"
        :length="pages"
        :total-visible="12"
      />
    </div>
  </v-card>
</template>

<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import { kModrinthInstall } from '@/composables/modrinthInstall'
import { useModrinthVersions } from '@/composables/modrinthVersions'
import { injection } from '@/util/inject'
import ModrinthProjectVersionsTile from './ModrinthProjectVersionsTile.vue'

const props = defineProps<{
  versions: string[]
  project: string
  modpack: boolean
}>()

const { onInstall } = injection(kModrinthInstall)

// modrinth versions
const { versions: projectVersions, error: versionsError, refresh, refreshing } = useModrinthVersions(computed(() => props.project))

const { t } = useI18n()
const gameVersions = computed(() => projectVersions.value.map(v => v.game_versions).reduce((a, b) => [...a, ...b], []))
const gameVersion = ref('')
const releaseTypes = computed(() => [
  { text: t('versionType.alpha'), value: 'alpha' },
  { text: t('versionType.beta'), value: 'beta' },
  { text: t('versionType.release'), value: 'release' },
])
const releaseType = ref('')
const modLoaders = ['forge', 'fabric']
const modLoader = ref('')

const items = computed(() => projectVersions.value.filter(v => {
  if (gameVersion.value) {
    return v.game_versions.indexOf(gameVersion.value) !== -1
  }
  if (releaseType.value) {
    return v.version_type === releaseType.value
  }
  if (modLoader.value) {
    return v.loaders.indexOf(modLoader.value) !== -1
  }
  return true
}))

const pageCount = 15
const pages = computed(() => Math.ceil(items.value.length / pageCount))
const page = ref(1)

const visibleVersions = computed(() => {
  return items.value.slice((page.value - 1) * pageCount, page.value * pageCount)
})
</script>

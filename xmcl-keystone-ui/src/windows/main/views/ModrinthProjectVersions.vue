<template>
  <v-card>
    <div class="flex gap-5 mx-5 mt-3">
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
    <table
      v-else
      class="w-full table-auto border-separate align-middle"
      style="border-spacing: 0.75em"
    >
      <thead
        class="text-gray-400 font-bold text-lg align-middle"
      >
        <tr>
          <th
            role="presentation"
          />
          <th class="text-left">
            {{ t('modrinth.headers.version') }}
          </th>
          <th class="text-left">
            {{ t('modrinth.headers.support') }}
          </th>
          <th class=" text-left">
            {{ t('modrinth.headers.status') }}
          </th>
        </tr>
      </thead>
      <tbody
        class="align-middle"
      >
        <template
          v-for="version of items"
        >
          <tr
            :key="version.id"
            class="dark:text-gray-300 text-gray-700"
          >
            <td>
              <v-btn
                v-if="!modpack || !isDownloaded(version)"
                icon
                text
                :loading="isDownloading(version)"
                :disabled="isDownloaded(version)"
                @click.stop="emit('install', version)"
              >
                <v-icon>file_download</v-icon>
              </v-btn>
              <v-btn
                v-else
                icon
                text
                @click.stop="onCreate(version)"
              >
                <v-icon> add </v-icon>
              </v-btn>
            </td>
            <td>
              <div>
                {{ version.name }}
              </div>
              <div>
                <span
                  :style="{ color: getColorCode(getColorForReleaseType(version.version_type)),borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
                  class="font-bold border-l border-l-[3px] pl-3"
                >
                  {{ t(`versionType.${version.version_type}`) }}
                </span>
                ·
                {{ version.version_number }}
              </div>
            </td>
            <td>
              <div class="flex">
                {{ version.loaders.join(', ') }}
              </div>
              <div class="flex">
                {{ version.game_versions.join(', ') }}
              </div>
            </td>
            <td>
              <div>
                {{ t('downloadCount', { count: version.downloads }) }}
              </div>
              <div>
                {{ getLocalDateString(version.date_published) }}
              </div>
            </td>
          </tr>
          <tr
            v-if="version.changelog"
            :key="`${version.id}-changelog`"
          >
            <td />
            <td
              colspan="3"
              :style="{ borderColor: getColorCode(getColorForReleaseType(version.version_type)) }"
              class="border-l border-l-[3px] pl-3"
            >
              <div
                class="text-gray-500 hover:text-black dark:hover:text-gray-300 text-gray-500 transition-colors"
                v-html="render(version.changelog)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </v-card>
</template>

<script lang="ts" setup>
import { Ref } from '@vue/composition-api'
import { ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Persisted, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import Markdown from 'markdown-it'
import { useI18n, useRefreshable, useService, useServiceBusy } from '/@/composables'
import { useVuetifyColor } from '/@/composables/vuetify'
import { getColorForReleaseType } from '/@/util/color'
import { getLocalDateString } from '/@/util/date'

const props = defineProps<{
  versions: string[]
  project: string
  modpack: boolean
}>()

const emit = defineEmits(['install', 'create'])

const markdown = new Markdown({
  html: true,
})
const { getProjectVersions, state } = useService(ModrinthServiceKey)
const { state: resourceState } = useService(ResourceServiceKey)
const render = (s: string) => {
  return markdown.render(s)
}

const { getColorCode } = useVuetifyColor()

const projectVersions: Ref<ProjectVersion[]> = ref([])
const { t, tc } = useI18n()
const isDownloading = (ver: ProjectVersion) => {
  const fileUrl = ver.files[0].url
  return !!state.downloading.find(v => v.url === fileUrl)
}
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
const isDownloaded = (ver: ProjectVersion) => {
  const fileUrl = ver.files[0].url
  const find = (m: Persisted<Resource>) => {
    if (m.uri.indexOf(fileUrl) !== -1) {
      return true
    }
    if (m.metadata.modrinth) {
      const s = m.metadata.modrinth
      if (s.url === fileUrl) return true
    }
    return false
  }
  return !!resourceState.mods.find(find) || !!resourceState.modpacks.find(find)
}

const onCreate = (v: ProjectVersion) => {
  emit('create', v)
}
// const headers = computed(() => [{
//   text: t('name'),
//   value: 'name',
//   // sortable: false,
// }, {
//   text: tc('version.name', 1),
//   value: 'version',
//   // sortable: true,
// }, {
//   text: t('modrinth.modLoaders.name'),
//   value: 'dependencies',
// }, {
//   text: t('modrinth.avaiableFor'),
//   value: 'game_versions',
// }, {
//   text: t('versionType.name'),
//   value: 'version_type',
//   sortable: false,
// }, {
//   text: t('modrinth.downloads'),
//   value: 'downloads',
// }, {
//   text: t('modrinth.createAt'),
//   value: 'date_published',
// }, {
//   text: '',
//   sortable: false,
// }])
const refreshing = useServiceBusy(ModrinthServiceKey, 'getProjectVersion', computed(() => props.project))
const { refresh } = useRefreshable(async () => {
  const result = await getProjectVersions(props.project)
  projectVersions.value = result
})
onMounted(() => {
  refresh()
})
const filter = (value: any, search: string | null, item: ProjectVersion) => {
  if (gameVersion.value) {
    return item.game_versions.indexOf(gameVersion.value) !== -1
  }
  return true
}
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
</script>

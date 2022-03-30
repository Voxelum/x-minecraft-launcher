<template>
  <v-data-table
    :headers="headers"
    :loading="refreshing"
    :items="items"
    :expand="false"
    :custom-filter="filter"
  >
    <template #top>
      <div class="flex gap-5 mx-5 mt-3">
        <v-select
          v-model="gameVersion"
          clearable
          hide-details
          flat
          solo
          dense
          :items="gameVersions"
          :label="$t('modrinth.gameVersions.name')"
        />
        <v-select
          v-model="modLoader"
          clearable
          hide-details
          flat
          solo
          dense
          :items="modLoaders"
          :label="$t('modrinth.modLoaders.name')"
        />
        <v-select
          v-model="releaseType"
          clearable
          hide-details
          flat
          solo
          dense
          :items="releaseTypes"
          :label="$t('modrinth.versionType.name')"
        />
      </div>
    </template>
    <template #item="props">
      <tr
        class="cursor-pointer"
        @click="props.expand( !props.isExpanded)"
      >
        <td>
          {{ props.item.name }}
        </td>
        <td>
          {{ props.item.version_number }}
        </td>
        <td class="">
          <v-chip
            v-for="l of props.item.loaders"
            :key="l"
            small
            label
            outlined
            color="white"
          >
            {{ l }}
          </v-chip>
        </td>
        <td class="">
          <div class="flex gap-1 items-center overflow-auto flex-wrap max-w-50 py-2">
            <v-chip
              v-for="l of props.item.game_versions"
              :key="l"
              small
              label
              outlined
              color="white"
            >
              {{ l }}
            </v-chip>
          </div>
        </td>
        <td>
          {{ $t(`modrinth.versionType.${props.item.version_type}`) }}
        </td>
        <td>
          {{ props.item.downloads }}
        </td>
        <td>
          {{ new Date(props.item.date_published).toLocaleDateString() }}
        </td>
        <td>
          <v-btn
            icon
            text
            :loading="isDownloading(props.item)"
            :disabled="isDownloaded(props.item)"
            @click.stop="$emit('install', props.item)"
          >
            <v-icon>file_download</v-icon>
          </v-btn>
        </td>
      </tr>
    </template>
    <template #expanded-item="props">
      <tr span>
        <td colspan="8">
          <!-- <v-card-text
          v-for="file in props.item.files"
          :key="file.filename"
          class="flex"
        >
          {{ file.filename }}
          {{ file.url }}
        </v-card-text>-->
          <v-card-text v-if="props.item.changelog">
            <div v-html="render(props.item.changelog)" />
          </v-card-text>
        </td>
      </tr>
    </template>
  </v-data-table>
</template>
<script lang="ts">
import { computed, defineComponent, onMounted, ref, Ref } from '@vue/composition-api'
import { ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, PersistedResource, ResourceServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService, useRefreshable } from '/@/composables'
import { required } from '/@/util/props'
import Markdown from 'markdown-it'

export default defineComponent({
  props: {
    versions: required<string[]>(Array),
    project: required<string>(String),
  },
  setup(props) {
    const markdown = new Markdown()
    const { getProjectVersions, state } = useService(ModrinthServiceKey)
    const { state: resourceState } = useService(ResourceServiceKey)
    const render = (s: string) => {
      return markdown.render(s)
    }
    const versions: Ref<ProjectVersion[]> = ref([])
    const { $t, $tc } = useI18n()
    const isDownloading = (ver: ProjectVersion) => {
      const fileUrl = ver.files[0].url
      return !!state.downloading.find(v => v.url === fileUrl)
    }
    const gameVersions = computed(() => versions.value.map(v => v.game_versions).reduce((a, b) => [...a, ...b], []))
    const gameVersion = ref('')
    const releaseTypes = computed(() => [
      { text: $t('modrinth.versionType.alpha'), value: 'alpha' },
      { text: $t('modrinth.versionType.beta'), value: 'beta' },
      { text: $t('modrinth.versionType.release'), value: 'release' },
    ])
    const releaseType = ref('')
    const modLoaders = ['forge', 'fabric']
    const modLoader = ref('')
    const isDownloaded = (ver: ProjectVersion) => {
      const fileUrl = ver.files[0].url
      const find = (m: PersistedResource) => {
        if (m.uri.indexOf(fileUrl) !== -1) {
          return true
        }
        if ('modrinth' in m && typeof m.modrinth === 'object') {
          const s = m.modrinth
          if (s.url === fileUrl) return true
        }
        return false
      }
      return !!resourceState.mods.find(find)
    }
    const headers = computed(() => [{
      text: $t('name'),
      value: 'name',
      // sortable: false,
    }, {
      text: $tc('version.name', 1),
      value: 'version',
      // sortable: true,
    }, {
      text: $t('modrinth.modLoaders.name'),
      value: 'dependencies',
    }, {
      text: $t('modrinth.avaiableFor'),
      value: 'game_versions',
    }, {
      text: $t('modrinth.versionType.name'),
      value: 'version_type',
      sortable: false,
    }, {
      text: $t('modrinth.downloads'),
      value: 'downloads',
    }, {
      text: $t('modrinth.createAt'),
      value: 'date_published',
    }, {
      text: '',
      sortable: false,
    }])
    const { refresh, refreshing } = useRefreshable(async () => {
      const result = await getProjectVersions(props.project)
      versions.value = result
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
    const items = computed(() => versions.value.filter(v => {
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
    return {
      filter,
      modLoader,
      modLoaders,
      releaseType,
      releaseTypes,
      gameVersion,
      gameVersions,
      refreshing,
      render,
      items,
      headers,
      isDownloading,
      isDownloaded,
    }
  },
})
</script>

<template>
  <v-data-table
    :headers="headers"
    :loading="refreshing"
    :items="mods"
    :expand="false"
  >
    <template #items="props">
      <tr class="cursor-pointer">
        <td @click="props.expanded = !props.expanded">
          {{ props.item.name }}
        </td>
        <td @click="props.expanded = !props.expanded">
          {{ props.item.version_number }}
        </td>
        <td @click="props.expanded = !props.expanded">
          <v-chip
            v-for="l of props.item.loaders"
            :key="l"
            small
            label
            outline
            color="white"
          >
            {{ l }}
          </v-chip>
        </td>
        <td @click="props.expanded = !props.expanded">
          <v-chip
            v-for="l of props.item.game_versions"
            :key="l"
            small
            label
            outline
            color="white"
          >
            {{ l }}
          </v-chip>
        </td>
        <td
          @click="props.expanded = !props.expanded"
        >
          {{ $t(`modrinth.versionType.${props.item.version_type}`) }}
        </td>
        <td @click="props.expanded = !props.expanded">
          {{ props.item.downloads }}
        </td>
        <td
          @click="props.expanded = !props.expanded"
        >
          {{ new Date(props.item.date_published).toLocaleDateString() }}
        </td>
        <td>
          <v-btn
            icon
            flat
            :loading="isDownloading(props.item)"
            :disabled="isDownloaded(props.item)"
            @click="$emit('install', props.item)"
          >
            <v-icon>file_download</v-icon>
          </v-btn>
        </td>
      </tr>
    </template>
    <template #expand="props">
      <v-card flat>
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
      </v-card>
    </template>
  </v-data-table>
</template>
<script lang="ts">
import { computed, defineComponent, onMounted, ref, Ref } from '@vue/composition-api'
import { ModVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, PersistedResource, ResourceServiceKey } from '@xmcl/runtime-api'
import { useI18n, useService } from '/@/hooks'
import { useRefreshable } from '/@/hooks/useRefreshable'
import { required } from '/@/util/props'
import Markdown from 'markdown-it'

export default defineComponent({
  props: {
    versions: required<string[]>(Array),
  },
  setup(props) {
    const markdown = new Markdown()
    const { getModVersion, state } = useService(ModrinthServiceKey)
    const { state: resourceState } = useService(ResourceServiceKey)
    const render = (s: string) => {
      return markdown.render(s)
    }
    const mods: Ref<ModVersion[]> = ref([])
    const { $t, $tc } = useI18n()
    const isDownloading = (ver: ModVersion) => {
      const fileUrl = ver.files[0].url
      return !!state.downloading.find(v => v.url === fileUrl)
    }
    const isDownloaded = (ver: ModVersion) => {
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
      console.log(resourceState.mods)
      console.log(resourceState.mods.find(find))
      return resourceState.mods.find(find)
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
      const result = await Promise.all(props.versions.map(v => getModVersion(v)))
      mods.value = result
    })
    onMounted(() => {
      refresh()
    })
    return {
      refreshing,
      render,
      mods,
      headers,
      isDownloading,
      isDownloaded,
    }
  },
})
</script>

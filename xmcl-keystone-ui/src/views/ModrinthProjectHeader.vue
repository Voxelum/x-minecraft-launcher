<template>
  <v-card
    outlined
    class="rounded-lg p-4 flex gap-6"
  >
    <v-img
      :src="project.icon_url"
      width="200"
      max-width="200"
      class="rounded-lg"
    />
    <div class="flex flex-col gap-2 items-start">
      <a
        class="text-2xl font-bold"
        :href="`https://modrinth.com/${project.project_type}/${project.slug}`"
      >
        {{ project.title }}
      </a>
      <span class="text-lg">{{ project.description }}</span>

      <span class="flex gap-2">
        <v-chip
          v-for="item of categoryItems"
          :key="item.name"
          label
          outlined
          class="mr-2"
        >
          <v-avatar
            left
            v-html="item.icon"
          />
          {{ t(`modrinth.categories.${item.name}`) }}
        </v-chip>
      </span>

      <v-divider />

      <span class="text-gray-400">
        <span>{{ t('modrinth.downloads') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ getExpectedSize(project.downloads, '') }}
        </span>
        <v-icon
          class="material-icon-outlined text-gray-300 mb-2 mr-2"
        >
          star_rate
        </v-icon>
        <span>{{ t('modrinth.followers') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ project.followers }}
        </span>
      </span>
      <span class="flex gap-2 items-center dark:text-gray-400 text-gray-500 w-full">
        <span class="flex gap-1 flex-grow-0">
          <v-icon
            class="material-icon-outlined text-gray-300 left"
          >
            event
          </v-icon>
          <span>{{ t('modrinth.createAt') }}</span>
          {{ getLocalDateString(project.published) }}
        </span>

        <span class="flex gap-1 flex-grow-0">
          <v-icon
            class="material-icon-outlined text-gray-300 left"
          >
            update
          </v-icon>
          <span>{{ t('modrinth.updateAt') }}</span>
          {{ getLocalDateString(project.updated) }}
        </span>
      </span>

      <span class="flex-grow" />
      <span class="flex gap-4 flex-1 flex-grow-0 w-full">
        <a
          v-if="project.discord_url"
          :href="project.discord_url"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Discord
        </a>
        <a
          v-if="project.issues_url"
          :href="project.issues_url"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Issue
        </a>
        <a
          v-if="project.source_url"
          :href="project.source_url"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Source
        </a>
        <a
          v-if="project.wiki_url"
          :href="project.wiki_url"
          class="flex items-center gap-1 flex-grow-0"
        >
          <v-icon>open_in_new</v-icon>Wiki
        </a>
        <div class="flex-grow" />

      </span>

      <div class="flex w-full flex-wrap gap-2">
        <CurseforgeProjectDestMenu
          :value="props.installTo"
          :block="false"
          :disabled="project.project_type !== 'mod'"
          @input="emit('destination', $event)"
        />
        <div class="flex-grow" />
        <div class="flex items-center gap-2 flex-shrink flex-grow-0">
          <v-menu offset-y>
            <template #activator="{ on, attrs }">
              <v-btn
                color="primary"
                class="flex-grow"
                :loading="loading || isDownloading"
                v-bind="attrs"
                v-on="on"
                @click="onInstallClicked"
              >
                <v-icon
                  left
                  class="absolute left-0"
                >
                  keyboard_arrow_down
                </v-icon>
                <span class="w-full">
                  <v-icon left>
                    download
                  </v-icon>
                  {{ t('modrinth.install') }}
                </span>
              </v-btn>
            </template>
            <v-list
              class="max-h-100 overflow-auto"
            >
              <v-list-item
                v-for="item of projectVersions"
                :key="item.id"
                class="border-l border-l-[3px] pl-3"
                :style="{ borderColor: getColorCode(getColorForReleaseType(item.version_type)) }"
                @click="onInstallItemClick(item)"
              >
                <v-list-item-title>{{ item.name }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { Ref } from 'vue'
import { Category, Project, ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Persisted, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import CurseforgeProjectDestMenu from './CurseforgeProjectDestMenu.vue'
import { useRefreshable, useService, useServiceBusy } from '@/composables'
import { useVuetifyColor } from '@/composables/vuetify'
import { getColorForReleaseType } from '@/util/color'
import { getLocalDateString } from '@/util/date'
import { getExpectedSize } from '@/util/size'

const props = defineProps<{
  project: Project
  installTo: string
}>()
const { t } = useI18n()
const { getTags } = useService(ModrinthServiceKey)
const categories = ref([] as Category[])

const emit = defineEmits(['install', 'create', 'destination'])

const categoryItems = computed(() => {
  return props.project.categories.map(id => categories.value.find(c => c.name === id)).filter((v): v is Category => !!v)
})

const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getTags()
  categories.value = result.categories
})

const { getProjectVersions, state } = useService(ModrinthServiceKey)
const projectVersions: Ref<ProjectVersion[]> = ref([])
const loading = useServiceBusy(ModrinthServiceKey, 'getProjectVersion', computed(() => props.project.id))

async function onInstallClicked() {
  if (projectVersions.value.length === 0) {
    const result = await getProjectVersions(props.project.id)
    projectVersions.value = result
  }
}

const { state: resourceState } = useService(ResourceServiceKey)
const isDownloading = computed(() => {
  for (const u of state.downloading) {
    if (projectVersions.value.some(v => v.files[0].url === u.url)) {
      return true
    }
  }
  return false
})
const isDownloaded = (ver: ProjectVersion) => {
  const fileUrl = ver.files[0].url
  const find = (m: Persisted<Resource>) => {
    if (m.uri.indexOf(fileUrl) !== -1) {
      return true
    }
    // if (typeof m.metadata.modrinth === 'object') {
    //   const s = m.metadata.modrinth
    //   if (s.url === fileUrl) return true
    // }
    return false
  }
  return !!resourceState.mods.find(find) || !!resourceState.modpacks.find(find)
}

const { getColorCode } = useVuetifyColor()

async function onInstallItemClick(version: ProjectVersion) {
  if (isDownloaded(version)) {
    emit('create', version)
  } else {
    emit('install', version)
  }
}

onMounted(refresh)

</script>

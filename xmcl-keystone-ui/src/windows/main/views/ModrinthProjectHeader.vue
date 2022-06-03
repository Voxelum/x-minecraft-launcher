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
      <span class="text-gray-400">
        <span>{{ t('modrinth.downloads') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ getExpectedSize(project.downloads, '') }}
        </span>
        <span>{{ t('modrinth.followers') }}</span>
        <span class="text-2xl font-bold dark:text-gray-300 text-gray-600">
          {{ project.followers }}
        </span>
      </span>
      <span>
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
          {{ $t(`modrinth.categories.${item.name}`) }}
        </v-chip>
      </span>
      <span class="flex gap-1 items-center dark:text-gray-400 text-gray-500">
        <v-icon
          small
          class="material-icon-outlined"
        >
          event
        </v-icon>
        <div>
          <span>{{ t('modrinth.createAt') }}</span>
          {{ getLocalDateString(project.published) }}
        </div>
      </span>
      <!-- <v-divider /> -->
      <span class="flex-grow" />
      <span class="flex gap-4 flex-1 flex-grow-0">
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
      </span>
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import { Category, Project } from '@xmcl/modrinth'
import { ModrinthServiceKey } from '@xmcl/runtime-api'
import { useI18n, useRefreshable, useService } from '/@/composables'
import { getLocalDateString } from '/@/util/date'
import { getExpectedSize } from '/@/util/size'

const props = defineProps<{ project: Project }>()
const { t } = useI18n()
const { getTags } = useService(ModrinthServiceKey)
const categories = ref([] as Category[])

const categoryItems = computed(() => {
  return props.project.categories.map(id => categories.value.find(c => c.name === id)).filter((v): v is Category => !!v)
})

const { refresh, refreshing } = useRefreshable(async () => {
  const result = await getTags()
  categories.value = result.categories
})

onMounted(refresh)

</script>

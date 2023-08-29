<template>
  <div class="flex flex-row items-center gap-4 lg:flex-col">
    <v-img
      height="150"
      width="150"
      max-width="150"
      :src="project.icon_url"
      class="rounded-lg"
    />
    <div class="flex flex-col items-start gap-2">
      <a
        class="text-2xl font-bold"
        target="browser"
        :href="`https://modrinth.com/${project.project_type}/${project.slug}`"
      >
        {{ project.title }}
      </a>
      <span class="">{{ project.description }}</span>

      <span class="flex gap-2">
        <v-chip
          v-for="item of categoryItems"
          :key="item.name"
          label
          outlined
          class="mr-2"
        >
          <v-avatar
            v-if="item.icon"
            left
            v-html="item.icon"
          />
          {{ t(`modrinth.categories.${item.name}`) }}
        </v-chip>
      </span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useModrinthTags } from '@/composables/modrinth'
import { Category, Project } from '@xmcl/modrinth'

const props = defineProps<{
  project: Project
}>()
const { t } = useI18n()

const { categories } = useModrinthTags()

const categoryItems = computed(() => {
  return props.project.categories.map(id => categories.value.find(c => c.name === id)).filter((v): v is Category => !!v)
})

</script>
